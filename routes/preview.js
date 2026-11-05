// /preview - reflected HTML injection
// hidden route, not linked anywhere, auth required
// same problem as search: DAST cant find it without SAST feeding the route
const express = require('express');
const requireAuth = require('../lib/auth');

const router = express.Router();

router.get('/preview', requireAuth, (req, res) => {
  const html = req.query.html || '';                  // user input

  // vuln: raw user markup dropped straight into the page
  // no encoding, no sanitization, full XSS
  res.send('<!doctype html><html><head><title>Preview · VulnTarget</title>' +
    '<link rel="stylesheet" href="/style.css"></head><body class="page"><main class="wrap">' +
    '<h2>Preview</h2><div class="preview">' + html + '</div>' +
    '<p><a href="/dashboard" class="muted">&larr; Dashboard</a></p>' +
    '</main></body></html>');
});

module.exports = router;
