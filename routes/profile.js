// /profile - stored XSS through display_name
// user sets their display name, its saved raw, rendered raw
// classic stored XSS: attacker puts a script tag in display_name, anyone who views the profile runs it
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { render } = require('../lib/views');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.session.user.username);
  res.send(render('profile', {
    user: user.username,
    role: user.role,
    displayNameRaw: user.display_name,  // this one renders raw in the template, thats the vuln
    displayName: user.display_name
  }));
});

router.post('/profile', requireAuth, (req, res) => {
  const name = req.body.display_name || '';
  // saved as-is, no sanitization
  db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run(name, req.session.user.username);
  res.redirect('/profile');
});

module.exports = router;
