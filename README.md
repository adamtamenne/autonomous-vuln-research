# Autonomous Vulnerability Research Pipeline

A four-stage security pipeline that bridges the gap between static analysis and dynamic testing using AI agents. SAST raises the lead, DAST shows where standard scanning stops, and agents close the gap by reading source code, authenticating, crafting payloads, and confirming exploitation in a real browser.

Built as a working demo for an OWASP presentation on autonomous vulnerability validation.

## How It Works

```mermaid
flowchart TD
    subgraph SOURCE ["Source code: 5 vulnerabilities"]
        V1["Reflected XSS\n/search (hidden route)"]
        V2["SQL Injection\n/filter"]
        V3["HTML Injection\n/preview (hidden route)"]
        V4["Path Traversal\n/attachment"]
        V5["Path Traversal\n/download (filtered)"]
    end

    subgraph SAST ["Stage 1: SAST (OpenGrep) — reads source"]
        S1["Found ⚠️\nunconfirmed"]
        S2["Found ⚠️\nunconfirmed"]
        S3["Found ⚠️\nunconfirmed"]
        S4["Found ⚠️\nunconfirmed"]
        S5["Found ⚠️\nunconfirmed"]
    end

    subgraph DAST ["Stage 2: DAST (OWASP ZAP) — hits live app"]
        D1["Missed ❌\ncan't discover route"]
        D2["Found ✅\nconfirmed"]
        D3["Missed ❌\ncan't discover route"]
        D4["Found ✅\nconfirmed"]
        D5["Missed ❌\nfilter blocks fuzz"]
    end

    subgraph AGENTS ["Stages 3-4: Agents bridge the gap"]
        A1["Validation Agent\nresolved route from source\nauthenticated via Playwright\nconfirmed XSS execution ✅"]
        A3["Validation Agent\nresolved route from source\nauthenticated via Playwright\nconfirmed injection ✅"]
        A5["Exploitation Agent\nClaude reviewed filter logic\ncode built bypass payload\nconfirmed /etc/passwd leak ✅"]
    end

    V1 --> S1 --> D1 --> A1
    V2 --> S2 --> D2
    V3 --> S3 --> D3 --> A3
    V4 --> S4 --> D4
    V5 --> S5 --> D5 --> A5

    style SOURCE fill:none,stroke:#555,color:#ccc
    style SAST fill:none,stroke:#8b0000,color:#ccc
    style DAST fill:none,stroke:#b45309,color:#ccc
    style AGENTS fill:none,stroke:#7c3aed,color:#ccc

    style V1 fill:#2d2d2d,color:#fff,stroke:#555
    style V2 fill:#2d2d2d,color:#fff,stroke:#555
    style V3 fill:#2d2d2d,color:#fff,stroke:#555
    style V4 fill:#2d2d2d,color:#fff,stroke:#555
    style V5 fill:#2d2d2d,color:#fff,stroke:#555

    style S1 fill:#8b0000,color:#fff,stroke:#b22222
    style S2 fill:#8b0000,color:#fff,stroke:#b22222
    style S3 fill:#8b0000,color:#fff,stroke:#b22222
    style S4 fill:#8b0000,color:#fff,stroke:#b22222
    style S5 fill:#8b0000,color:#fff,stroke:#b22222

    style D1 fill:#7f1d1d,color:#fca5a5,stroke:#dc2626
    style D2 fill:#065f46,color:#6ee7b7,stroke:#10b981
    style D3 fill:#7f1d1d,color:#fca5a5,stroke:#dc2626
    style D4 fill:#065f46,color:#6ee7b7,stroke:#10b981
    style D5 fill:#7f1d1d,color:#fca5a5,stroke:#dc2626

    style A1 fill:#7c3aed,color:#fff,stroke:#8b5cf6
    style A3 fill:#7c3aed,color:#fff,stroke:#8b5cf6
    style A5 fill:#0369a1,color:#fff,stroke:#0ea5e9
```

**Stage 1 — SAST (OpenGrep):** Custom rules scan the source and flag five potential vulnerabilities. These are leads, not confirmed bugs.

**Stage 2 — DAST (OWASP ZAP):** Three scan tiers (no auth, authenticated, agent-fed routes) show what a standard dynamic scan can and cannot reach.

**Stage 3 — Validation Agent (Node + Playwright):** Reads the SAST finding, resolves the route and parameter from source code, extracts credentials from the seed file, authenticates in a headless browser, delivers the payload, and confirms execution against a negative control.

**Stage 4 — Exploitation Agent (Node + Claude):** For filtered endpoints, sends the handler source to Claude for a defensive code review. Claude classifies the weakness type. The agent's own code translates that classification into bypass payloads, delivers them authenticated, and confirms the leak.

## Target Application

VulnTarget is a deliberately vulnerable Node/Express bug-reporting portal with six seeded weaknesses. Run it locally only.

| Vuln | Route | SAST | Standard DAST | Agent Needed |
|------|-------|------|---------------|--------------|
| Reflected XSS | `GET /search?q=` | Found | Missed (hidden route) | Yes |
| Stored XSS | Comments / profile name | Missed | Found | No |
| SQL Injection | `GET /filter?status=` | Found | Found | No |
| HTML Injection | `GET /preview?html=` | Found | Missed (hidden route) | Yes |
| Path Traversal | `GET /attachment?file=` | Found | Found | No |
| Path Traversal (filtered) | `GET /download?file=` | Found | Missed (filter blocks fuzz) | Yes |

## Quick Start

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker compose up --build
```

Open http://localhost:3000, log in as `alice / password123`.

## Running the Pipeline

```bash
# Stage 1: SAST
docker compose run --rm scanner

# Stage 2: DAST (authenticated tier)
docker compose run --rm zap zap.sh -cmd -autorun /zap/wrk/plan-2-auth.yaml

# Stage 3: Validate XSS (agent + Playwright)
docker compose run --rm agent

# Stage 4: Exploit filtered traversal (agent + Claude)
docker compose run --rm --entrypoint node agent exploit-traversal.js
```

## Output

| Stage | Produces |
|-------|----------|
| SAST | `out/findings.json` |
| DAST | `zap/zap-out/*.html`, `zap/zap-out/*.json` |
| XSS Agent | `agent/poc/poc.md`, `agent/poc/poc.json` |
| Traversal Agent | `agent/poc/poc-traversal.md`, `agent/poc/poc-traversal.json` |

## Key Design Decisions

**Source-aware agents:** The agents read the application source code alongside the SAST finding. This lets them resolve hidden routes, extract auth credentials from seed data, and understand filter logic that a standard scanner never sees.

**LLM does review, code does exploitation:** The traversal agent asks Claude to classify the filter weakness defensively. The agent's own code builds the actual payloads. This keeps the LLM in an advisory role while the deterministic code handles execution.

**Negative controls:** Every proof is validated against a clean input to confirm the vulnerability is real, not a false positive.

## Demo Accounts

| Username | Password | Role |
|----------|----------|------|
| alice | password123 | engineer |
| bob | password123 | engineer |
| admin | admin123 | admin |