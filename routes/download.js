// GET /download?file=  — download a report attachment, WITH a safeguard.
// VULN: path traversal that survives a naive filter.
// Difficulty: HARD — the filter blocks obvious ../ payloads (and a plain DAST fuzz),
// so it takes a crafted bypass. The agent reads this filter and engineers one.
const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../lib/auth');

const router = express.Router();
const UPLOADS = path.join(__dirname, '..', 'uploads');

router.get('/download', requireAuth, (req, res) => {
  const requested = req.query.file || 'readme.txt';   // SOURCE
  // SAFEGUARD (insufficient): strip "../" sequences before use.
  // The flaw: it is a single, NON-RECURSIVE pass, so "....//" collapses back into
  // "../" after the inner "../" is removed — and slips straight through.
  const safe = requested.replace(/\.\.\//g, '');       // TODO: path.resolve + verify it stays under UPLOADS
  const full = path.join(UPLOADS, safe);               // SINK
  try {
    const data = fs.readFileSync(full);                // ....//....//....//etc/passwd  -> ../../../etc/passwd
    res.type('text/plain').send(data);
  } catch (e) {
    res.status(404).type('text/plain').send('Not found');
  }
});

module.exports = router;
