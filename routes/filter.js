// /filter - SQL injection
// linked from dashboard so DAST finds this on its own
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { esc } = require('../lib/views');

const router = express.Router();

router.get('/filter', requireAuth, (req, res) => {
  const status = req.query.status || 'open';          // user input

  // vuln: status concatenated straight into the query string
  // should be a bound parameter like the other queries
  const rows = db.prepare(`SELECT * FROM reports WHERE status = '${status}'`).all();

  const items = rows.map(r =>
    `<tr><td class="muted">#${esc(String(r.id))}</td><td><a href="/report/${esc(String(r.id))}">${esc(r.title)}</a></td><td><span class="badge badge-${esc(r.status)}">${esc(r.status)}</span></td></tr>`
  ).join('');

  // status IS escaped in the HTML so no XSS, the bug is only in the SQL above
  res.send(`<!doctype html>
    <html><head><title>Filter · VulnTarget</title><link rel="stylesheet" href="/style.css"></head>
    <body class="page"><main class="wrap">
      <p><a href="/dashboard" class="muted">&larr; Dashboard</a></p>
      <h2>Reports with status: ${esc(status)}</h2>
      <table class="reports"><tbody>${items}</tbody></table>
    </main></body></html>`);
});

module.exports = router;
