// GET /search  <-- PRIMARY SAST TARGET
// Authenticated, and NOT linked from any nav — a link-following crawler never reaches it.
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { esc } = require('../lib/views');

const router = express.Router();

router.get('/search', requireAuth, (req, res) => {
  const q = req.query.q || '';                        // SOURCE: user-controlled input
  const results = db.prepare(
    `SELECT * FROM reports WHERE title LIKE ?`
  ).all(`%${q}%`);

  // SINK: q is interpolated into the HTML response without sanitization.
  // TODO: add template engine
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
