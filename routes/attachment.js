// /attachment - path traversal, no filter at all
// linked from report pages so DAST can reach it
// easier than download.js because theres nothing to bypass
const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../lib/auth');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');

router.get('/attachment', requireAuth, (req, res) => {
  const file = req.query.file || 'readme.txt';        // user input

  // vuln: file joined to uploads dir with zero validation
  // ?file=../../../../etc/passwd just works
  const full = path.join(UPLOADS, file);
  try {
    const data = fs.readFileSync(full);
    res.type('text/plain').send(data);
  } catch (e) {
    res.status(404).type('text/plain').send('Not found: ' + file);
  }
});

module.exports = router;
