// GET /filter?status=  — dashboard status filter.
// VULN: SQL injection — the status value is concatenated straight into the SQL string.
// Difficulty: EASY — linked from the dashboard, so a crawler reaches it.
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { esc } = require('../lib/views');

const router = express.Router();

router.get('/filter', requireAuth, (req, res) => {
  const status = req.query.status || 'open';          // SOURCE
  // SINK: status concatenated directly into SQL instead of a bound parameter.
  const rows = db.prepare(`SELECT * FROM reports WHERE status = '${status}'`).all(); // TODO: parameterize
  const items = rows.map(r =>
    `<tr><td class="muted">#${esc(String(r.id))}</td><td><a href="/report/${esc(String(r.id))}">${esc(r.title)}</a></td><td><span class="badge badge-${esc(r.status)}">${esc(r.status)}</span></td></tr>`
  ).join('');
  // status is escaped for display (no XSS here) — the bug is in the SQL above.
  res.send(`<!doctype html>
    <html><head><title>Filter · VulnTarget</title><link rel="stylesheet" href="/style.css"></head>
    <body class="page"><main class="wrap">
      <p><a href="/dashboard" class="muted">&larr; Dashboard</a></p>
      <h2>Reports with status: ${esc(status)}</h2>
      <table class="reports"><tbody>${items}</tbody></table>
    </main></body></html>`);
});

module.exports = router;
