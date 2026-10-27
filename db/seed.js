// Creates tables and seeds demo data on start. In-memory: a restart resets everything.
const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE users (
    username     TEXT PRIMARY KEY,
    password     TEXT NOT NULL,
    role         TEXT NOT NULL,
    display_name TEXT NOT NULL
  );
  CREATE TABLE reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL,
    submitter   TEXT NOT NULL,
    created     TEXT NOT NULL,
    description TEXT NOT NULL
  );
  CREATE TABLE comments (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    author    TEXT NOT NULL,
    body      TEXT NOT NULL,
    created   TEXT NOT NULL
  );
`);

const insUser = db.prepare('INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)');
insUser.run('alice', 'password123', 'engineer', 'Alice');
insUser.run('bob', 'password123', 'engineer', 'Bob');
insUser.run('admin', 'admin123', 'admin', 'Admin');

const insReport = db.prepare('INSERT INTO reports (title, status, submitter, created, description) VALUES (?, ?, ?, ?, ?)');
const reports = [
  ['CSRF token missing on /transfer', 'open', 'alice', '2026-09-28',
    'The funds transfer endpoint accepts POST requests without validating a CSRF token. A malicious page can forge a transfer on behalf of a logged-in user.'],
  ['Verbose error messages in production', 'open', 'bob', '2026-09-30',
    'Stack traces and SQL errors are returned to the client when a 500 occurs. This leaks table names and framework versions.'],
  ['Dependency: lodash 4.17.15 — prototype pollution', 'open', 'alice', '2026-10-02',
    'lodash 4.17.15 is vulnerable to prototype pollution via _.merge. Upgrade to >= 4.17.21.'],
  ['Session cookie missing Secure flag', 'closed', 'bob', '2026-10-05',
    'The session cookie is set without the Secure attribute, so it can be transmitted over plain HTTP.'],
  ['Open redirect on /login?next=', 'open', 'admin', '2026-10-09',
    'The next parameter is used for post-login redirect without allow-listing, enabling an open redirect to arbitrary hosts.'],
  ['Rate limiting absent on /login', 'closed', 'alice', '2026-10-12',
    'No throttling on authentication attempts allows unlimited credential-stuffing against the login form.']
];
const reportIds = reports.map(r => insReport.run(...r).lastInsertRowid);

const insComment = db.prepare('INSERT INTO comments (report_id, author, body, created) VALUES (?, ?, ?, ?)');
insComment.run(reportIds[0], 'bob', 'Confirmed on staging. Assigning to the platform team.', '2026-09-28');
insComment.run(reportIds[0], 'admin', 'Prioritised — this is a P1.', '2026-09-29');
insComment.run(reportIds[1], 'alice', 'Repro: hit /api/reports with a malformed id.', '2026-10-01');
insComment.run(reportIds[2], 'bob', 'PR open to bump the dependency.', '2026-10-03');
insComment.run(reportIds[4], 'alice', 'We should allow-list internal hosts only.', '2026-10-10');

module.exports = db;
