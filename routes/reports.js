// GET /report/:id, POST /report/:id/comment
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { render, esc } = require('../lib/views');

const router = express.Router();

router.get('/report/:id', requireAuth, (req, res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).send(render('dashboard', { user: req.session.user.username, rows: '<tr><td>Report not found.</td></tr>' }));

  const comments = db.prepare('SELECT * FROM comments WHERE report_id = ? ORDER BY id').all(report.id);
  // STORED XSS: comment body is rendered without encoding (raw).
  const commentHtml = comments.map(c => `
    <div class="comment">
      <div class="comment-head"><strong>${esc(c.author)}</strong> <span class="muted">${esc(c.created)}</span></div>
      <div class="comment-body">${c.body}</div>
    </div>`).join('') || '<p class="muted">No comments yet.</p>';

  res.send(render('report', {
    user: req.session.user.username,
    id: report.id,
    title: report.title,
    status: report.status,
    submitter: report.submitter,
    created: report.created,
    description: report.description,
    comments: commentHtml
  }));
});

router.post('/report/:id/comment', requireAuth, (req, res) => {
  const report = db.prepare('SELECT id FROM reports WHERE id = ?').get(req.params.id);
  if (!report) return res.redirect('/dashboard');
  const body = req.body.body || '';
  // Stored as-is, no sanitization.
  db.prepare('INSERT INTO comments (report_id, author, body, created) VALUES (?, ?, ?, ?)')
    .run(report.id, req.session.user.username, body, new Date().toISOString().slice(0, 10));
  res.redirect('/report/' + report.id);
});

module.exports = router;
