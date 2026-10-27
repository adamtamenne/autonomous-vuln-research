// Tiny view helper: loads views/*.html at startup and fills tokens.
//   {{token}}   -> HTML-escaped (safe)
//   {{{token}}} -> raw, NOT escaped (used deliberately for the stored-XSS sinks)
const fs = require('fs');
const path = require('path');

const VIEWS = path.join(__dirname, '..', 'views');
const cache = {};
for (const f of fs.readdirSync(VIEWS)) {
  if (f.endsWith('.html')) cache[f.replace('.html', '')] = fs.readFileSync(path.join(VIEWS, f), 'utf8');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render(name, data = {}) {
  let html = cache[name];
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => (data[k] == null ? '' : String(data[k])));
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] == null ? '' : esc(data[k])));
  return html;
}

module.exports = { render, esc };
