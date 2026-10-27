// POST /login, GET /logout, GET / (login page)
const express = require('express');
const db = require('../db/seed');
const { render } = require('../lib/views');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.send(render('login', { error: '' }));
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) {
    return res.status(401).send(render('login', { error: 'Invalid username or password.' }));
  }
  req.session.user = { username: user.username, role: user.role };
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
