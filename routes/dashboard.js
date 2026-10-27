// GET /dashboard — list of all bug reports
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { render, esc } = require('../lib/views');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  const reports = db.prepare('SELECT * FROM reports ORDER BY id').all();
  const rows = reports.map(r => `
    <tr>
      <td class="muted">#${r.id}</td>
      <td><a href="/report/${r.id}">${esc(r.title)}</a></td>
      <td><span class="badge badge-${esc(r.status)}">${esc(r.status)}</span></td>
      <td>${esc(r.submitter)}</td>
      <td class="muted">${esc(r.created)}</td>
    </tr>`).join('');
  res.send(render('dashboard', { user: req.session.user.username, rows }));
});

module.exports = router;
