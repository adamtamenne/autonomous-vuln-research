// GET /profile, POST /profile
const express = require('express');
const db = require('../db/seed');
const requireAuth = require('../lib/auth');
const { render } = require('../lib/views');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.session.user.username);
  // STORED XSS: display_name is rendered raw into the greeting.
  res.send(render('profile', {
    user: user.username,
    role: user.role,
    displayNameRaw: user.display_name,  // raw token {{{displayNameRaw}}}
    displayName: user.display_name       // escaped token for the input value
  }));
});

router.post('/profile', requireAuth, (req, res) => {
  const name = req.body.display_name || '';
  // Stored as-is, no sanitization.
  db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run(name, req.session.user.username);
  res.redirect('/profile');
});

module.exports = router;
