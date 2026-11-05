// /search - reflected XSS
// not linked anywhere in the UI so DAST crawlers never find it
// thats why the agent needs to feed this route from SAST data
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { esc } = require('../lib/views');

const router = express.Router();

router.get('/search', requireAuth, (req, res) => {
  const q = req.query.q || '';                        // user input comes in here

  // SQL is parameterized so no sqli here
  const results = db.prepare(
    `SELECT * FROM reports WHERE title LIKE ?`
  ).all(`%${q}%`);

  // vuln: q goes straight into the HTML with no encoding
  // try /search?q=<script>alert(1)</script> and it executes
  res.send(`<!doctype html>
    <html>
      <head><title>Search · VulnTarget</title><link rel="stylesheet" href="/style.css"></head>
      <body class="page">
        <main class="wrap">
          <h2>Results for: ${q}</h2>
          <ul class="results">
            ${results.map(r => `<li><a href="/report/${r.id}">${esc(r.title)}</a></li>`).join('')}
          </ul>
          <p><a href="/dashboard">&larr; Back to dashboard</a></p>
        </main>
      </body>
    </html>`);
});

module.exports = router;
