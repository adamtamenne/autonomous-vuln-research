// GET /preview?html=  — render an HTML/markdown preview.
// VULN: HTML injection (reflected) — user markup is concatenated straight into the response.
// Difficulty: HARD — not linked from any page (hidden, like /search) and auth-gated, so a
// standard crawl never reaches it; SAST finds it from source, DAST needs the route.
const express = require('express');
const requireAuth = require('../lib/auth');

const router = express.Router();

router.get('/preview', requireAuth, (req, res) => {
  const html = req.query.html || '';                  // SOURCE
  // SINK: user markup concatenated into the HTML response with no encoding.  // TODO: sanitize
  res.send('<!doctype html><html><head><title>Preview · VulnTarget</title>' +
    '<link rel="stylesheet" href="/style.css"></head><body class="page"><main class="wrap">' +
    '<h2>Preview</h2><div class="preview">' + html + '</div>' +
    '<p><a href="/dashboard" class="muted">&larr; Dashboard</a></p>' +
    '</main></body></html>');
});

module.exports = router;
