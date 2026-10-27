// GET /attachment?file=  — download a report attachment.
// VULN: path traversal — the filename is joined to the uploads dir with no containment.
// Difficulty: MEDIUM — linked from the report page, but needs a traversal payload.
const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../lib/auth');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');

router.get('/attachment', requireAuth, (req, res) => {
  const file = req.query.file || 'readme.txt';        // SOURCE
  // SINK: user-controlled filename joined to UPLOADS with no check that it stays inside.
  const full = path.join(UPLOADS, file);              // TODO: resolve + verify prefix === UPLOADS
  try {
    const data = fs.readFileSync(full);               // e.g. ?file=../../../../etc/passwd
    res.type('text/plain').send(data);
  } catch (e) {
    res.status(404).type('text/plain').send('Not found: ' + file);
  }
});

module.exports = router;
