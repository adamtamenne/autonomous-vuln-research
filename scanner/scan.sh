#!/bin/sh
# SAST reporter: runs opengrep, then prints a human-readable "potential vuln" summary
# (rule, severity, file, line, CWE, message, offending code) from the JSON output.
set -eu

RULES="${RULES:-/src/opengrep-rules}"
SRC="${SRC:-/src}"
OUT="${OUT:-/out/findings.json}"

# 1. Run the scan (opengrep prints its own scan summary UI).
opengrep scan --config="$RULES" --exclude=node_modules --json --output="$OUT" "$SRC"

# 2. Print a detailed, demo-friendly summary from the findings JSON.
COUNT=$(jq '.results | length' "$OUT")

printf '\n'
printf '======================================================================\n'
if [ "$COUNT" -eq 0 ]; then
  printf '  No findings.\n'
  printf '======================================================================\n\n'
  exit 0
fi
printf '  [!]  %s POTENTIAL VULNERABILITY(IES) FOUND   —   SAST / opengrep\n' "$COUNT"
printf '======================================================================\n'

jq -r '
  .results[] |
  "\n  POTENTIAL VULN  : " + .check_id +
  "\n  severity        : " + (if .extra.severity=="ERROR" then "HIGH" elif .extra.severity=="WARNING" then "MEDIUM" elif .extra.severity=="INFO" then "LOW" else (.extra.severity // "?") end) + "  (opengrep rule severity: " + (.extra.severity // "") + ")" +
  "\n  confidence      : " + ((.extra.metadata.confidence) // "n/a") +
  "\n  file            : " + (.path | sub("^/src/";"")) +
  "\n  line            : " + (.start.line|tostring) + "-" + (.end.line|tostring) +
  "\n  cwe             : " + ((.extra.metadata.cwe) // "") +
  "\n  message         : " + ((.extra.message // "") | gsub("\\s+";" ") | .[0:180]) +
  "\n  code            :\n" +
  ( (.extra.lines // "") | split("\n") | map("      | " + .) | join("\n") )
' "$OUT"

printf '\n  (unconfirmed — needs a PoC. Full machine-readable output -> out/findings.json)\n\n'
