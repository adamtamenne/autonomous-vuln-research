// /download - path traversal with a bypass
// has a filter but its single pass so ....// collapses to ../ after the strip
const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../lib/auth');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');

router.get('/download', requireAuth, (req, res) => {
  const requested = req.query.file || 'readme.txt';   // user input

  // this is the "fix" but its broken
  // single pass replace: ....// becomes ../ after the inner ../ is stripped
  // needs recursive replace or path.resolve + prefix check
  const safe = requested.replace(/\.\.\//g, '');

  const full = path.join(UPLOADS, safe);               // traversal lands here
  try {
    const data = fs.readFileSync(full);                // ....//....//....//etc/passwd reads /etc/passwd
    res.type('text/plain').send(data);
  } catch (e) {
    res.status(404).type('text/plain').send('Not found');
  }
});

module.exports = router;
