# Intentional Vulnerabilities — VulnTarget

> This application is **deliberately vulnerable** and built solely as a demo target
> for the OWASP talk *"Autonomous Vulnerability Research: Bridging SAST, DAST and
> Human Expertise."* Run it only locally. Do not deploy it anywhere reachable.

## XSS 1 — Reflected XSS in `GET /search` (primary demo target)

- **File:** `routes/search.js`
- **Taint path:** `req.query.q` (SOURCE) → `res.send(\`... ${q} ...\`)` (SINK)
- **Why DAST alone misses it:**
  - `/search` is **not linked** from any page or nav.
  - It requires an authenticated session.
  - A blind link-following crawler never submits the login form and never discovers the route.
- **Proof payload:**
  ```
  /search?q=<script>document.title='XSS-CONFIRMED-'+document.cookie</script>
  ```
- **Negative control (validator):** `/search?q=hello` reflects harmlessly, nothing executes.

## XSS 2 — Stored XSS in comments + profile display name (secondary)

- **Files:** `routes/reports.js` (comment body), `routes/profile.js` (display name)
- **Sink:** comment body and display name are rendered **raw** (unescaped) via the
  `{{{ ... }}}` tokens in `views/report.html` and `views/profile.html`.
- **Why it's the contrast case:** DAST *can* reach these by crawling and submitting
  forms — it finds this class on its own. The `/search` reflected XSS needs source
  context, which is the demo's payoff.
- **Proof payload (comment or display name):**
  ```
  <img src=x onerror=alert(document.cookie)>
  ```

## SQLi — SQL injection in `GET /filter` (string-concatenated query)

- **File:** `routes/filter.js`
- **Sink:** `` db.prepare(`SELECT * FROM reports WHERE status = '${status}'`) `` — the
  `status` query param is concatenated straight into SQL instead of bound as a parameter.
- **Linked** from the dashboard ("Filter by status"), so a DAST crawl reaches it, and SAST
  flags the concatenation — both tools find this one.
- **Proof:** `/filter?status=open' OR '1'='1` returns **all** reports (open and closed);
  `/filter?status='` triggers a SQL syntax error (error-based).

## HTMLi — HTML injection in `GET /preview` (reflected markup)

- **File:** `routes/preview.js`
- **Sink:** `res.send('... <div class="preview">' + req.query.html + '</div> ...')` — user
  markup concatenated into the HTML response with no encoding.
- **Hidden** (not linked, auth-gated), like `/search`: SAST flags it; a standard DAST crawl
  never discovers it. With no CSP it is script-capable, not merely defacement.
- **Proof:** `/preview?html=<h1>Injected</h1><s>defaced</s>` (or an `<img onerror=...>` payload).

## Path 1 — Path traversal in `GET /attachment` (no guard)

- **File:** `routes/attachment.js`
- **Sink:** `fs.readFileSync(path.join(UPLOADS, req.query.file))` — no containment check.
- **Linked** from the report page; both SAST and DAST find it. Medium difficulty.
- **Proof:** `/attachment?file=../../../../etc/passwd` returns `/etc/passwd`.

## Path 2 — Path traversal in `GET /download` (safeguarded; agent-bypass showcase)

- **File:** `routes/download.js`
- **Safeguard (insufficient):** `file.replace(/\.\.\//g, '')` — a single, NON-recursive pass,
  so `....//` collapses back into `../` and slips through.
- **Why it's the showcase:** the filter blocks obvious payloads and a plain DAST fuzz, so
  SAST flags it but a scanner can't prove it. The agent has the LLM **diagnose** the weakness
  (the frontier models *refuse* to write the exploit — a `cyber` refusal, itself a talking
  point), then builds the bypass in code.
- **Proof:** naive `/download?file=../../../../etc/passwd` is **blocked**; crafted
  `/download?file=....//....//....//....//etc/passwd` **leaks `/etc/passwd`**.
  See `agent/exploit-traversal.js` and `agent/poc/poc-traversal.md`.

## Deliberate supporting weaknesses

- Session cookie is set with `httpOnly: false` so `document.cookie` is visible to the payload.
- No CSP headers (payloads must execute on stage).
- No `robots.txt` (would hint at hidden routes).
- Passwords stored and compared in plaintext (demo simplicity).

## What is NOT vulnerable (by design)

- The SQL `LIKE` query in `/search` uses a **parameterised** statement — the XSS there is in
  the HTML rendering, not SQL injection. (The intentional SQL injection lives in `/filter`,
  which concatenates instead — see **SQLi** above.) Report titles rendered elsewhere ARE
  escaped, to keep the reflected `/search` sink the clean, isolated SAST target.

---

## Additional findings (difficulty spread)

| # | Vuln | Route | Linked? | SAST (opengrep) | DAST (ZAP std) | Difficulty |
|---|------|-------|---------|-----------------|----------------|------------|
| XSS 1 | Reflected XSS | `GET /search?q=` | No (hidden) | ✅ flags | ❌ misses (hidden) | Hard — needs agent |
| XSS 2 | Stored XSS | comments / profile name | Yes | ❌ (custom render) | ✅ finds | Easy |
| SQLi | SQL injection | `GET /filter?status=` | Yes | ✅ flags | ✅ finds | Easy |
| HTMLi | HTML injection | `GET /preview?html=` | No (hidden) | ✅ flags | ❌ misses (hidden) | Hard — needs agent |
| Path 1 | Path traversal (no guard) | `GET /attachment?file=` | Yes | ✅ flags | ✅ finds | Medium |
| Path 2 | Path traversal (**safeguarded**) | `GET /download?file=` | Yes | ✅ flags | ❌ naive payloads blocked | Hard — needs agent to craft a bypass |

**Path 2 — the agent-bypass showcase.** `/download` strips `../` with a single
non-recursive `.replace(/\.\.\//g,'')`. That blocks obvious payloads (and a plain DAST
fuzz), so SAST flags it but a scanner can't prove it. The validation agent has the LLM
**diagnose the filter's weakness class** (the frontier models *refuse* to write the
exploit itself — a `cyber`-policy refusal that is itself a talking point), then builds in
code a payload that survives one pass (`....//....//...` collapses back to `../../...`),
delivers it authenticated, and confirms the `/etc/passwd` leak — with the naive (blocked)
payload and a benign file as controls. See `agent/exploit-traversal.js` and
`agent/poc/poc-traversal.md`.
