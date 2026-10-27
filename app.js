// VulnTarget — internal security bug-reporting portal (DEMO TARGET)
// Deliberately vulnerable. See VULN.md.
const express = require('express');
const session = require('express-session');
const path = require('path');

require('./db/seed'); // creates tables + seed data on start

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'vuln-target-demo-secret',
  resave: false,
  saveUninitialized: false,
  // httpOnly intentionally false so document.cookie is visible to the demo payload
  cookie: { httpOnly: false }
}));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/reports'));
app.use('/', require('./routes/profile'));
app.use('/', require('./routes/search'));
app.use('/', require('./routes/filter'));
app.use('/', require('./routes/attachment'));
app.use('/', require('./routes/download'));
app.use('/', require('./routes/preview'));

app.listen(3000, () => {
  console.log('VulnTarget running on http://localhost:3000 — alice:password123 / admin:admin123');
});
