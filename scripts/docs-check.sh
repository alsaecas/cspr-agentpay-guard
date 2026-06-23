#!/usr/bin/env bash
# Lightweight docs sanity check for CSPR AgentPay Guard.
# Returns non-zero if any check fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
errors=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check_file() {
  if [ ! -f "$ROOT/$1" ]; then
    echo "  MISSING: $1"
    errors=$((errors + 1))
  fi
}

check_not_contains() {
  if grep -q "$2" "$ROOT/$1" 2>/dev/null; then
    echo "  STALE: $1 contains '$2'"
    errors=$((errors + 1))
  fi
}

check_contains() {
  if ! grep -q "$2" "$ROOT/$1" 2>/dev/null; then
    echo "  MISSING: $1 should contain '$2'"
    errors=$((errors + 1))
  fi
}

check_not_duplicate() {
  local count
  count=$(grep -c "$2" "$ROOT/$1" 2>/dev/null || echo 0)
  if [ "$count" -gt 1 ]; then
    echo "  DUPLICATE: $1 contains '$2' $count times"
    errors=$((errors + 1))
  fi
}

check_min_lines() {
  local lines
  lines=$(wc -l < "$ROOT/$1" 2>/dev/null || echo 0)
  if [ "$lines" -lt "$2" ]; then
    echo "  SHORT: $1 has $lines lines (need $2+)"
    errors=$((errors + 1))
  fi
}

check_no_long_lines() {
  local long
  long=$(rg -c '^.{300,}$' "$ROOT/$1" 2>/dev/null || echo 0)
  if [ "$long" -gt 0 ]; then
    echo "  LONG LINES: $1 has $long line(s) over 300 chars"
    errors=$((errors + 1))
  fi
}

# ---------------------------------------------------------------------------
# Required files
# ---------------------------------------------------------------------------

echo "=== CSPR AgentPay Guard — Docs Check ==="
echo ""

echo "Required files:"
for f in \
  README.md \
  docs/submission.md \
  docs/video-script.md \
  docs/final-checklist.md \
  docs/testnet-status.md \
  docs/technical-spike.md \
  docs/casper-contract-boundary.md \
  contracts/README.md \
  contracts/agentpay-guard/README.md \
  contracts/agentpay-guard/Cargo.toml \
  contracts/agentpay-guard/src/lib.rs; do
  check_file "$f"
done
echo ""

# ---------------------------------------------------------------------------
# Minimum line counts
# ---------------------------------------------------------------------------

echo "Line counts:"
check_min_lines "README.md"                             80
check_min_lines "docs/submission.md"                   80
check_min_lines "docs/video-script.md"                 60
check_min_lines "docs/final-checklist.md"              60
check_min_lines "docs/testnet-status.md"               60
check_min_lines "docs/technical-spike.md"             100
check_min_lines "contracts/README.md"                  40
check_min_lines "contracts/agentpay-guard/README.md"   50
check_min_lines "scripts/docs-check.sh"                60
echo ""

# ---------------------------------------------------------------------------
# Long line checks (skip tables with URLs and code blocks)
# ---------------------------------------------------------------------------

echo "Long lines (over 300 chars, excluding tables):"
# Check README for unreasonably long lines
long_readme=$(rg -c '^.{300,}$' "$ROOT/README.md" 2>/dev/null || echo 0)
echo "  README.md long lines: $long_readme (paragraph text is OK under 400)"
echo ""

# ---------------------------------------------------------------------------
# Content checks
# ---------------------------------------------------------------------------

echo "Stale claims:"
check_not_contains "contracts/agentpay-guard/README.md"  "init/is_initialized"
check_not_contains "contracts/README.md"                  "Scaffold only"
check_not_duplicate "README.md"                           "Production escrow/custody"
check_not_contains "README.md"                            "Prompt 13 current"
check_not_contains "README.md"                            "Prompt 11 current"
check_not_contains "docs/testnet-status.md"               "Prompt 11 — Final"
check_not_contains "docs/technical-spike.md"              "Odra crates \`2.7.2\` from crates.io"
check_not_contains "docs/technical-spike.md"              "Prompt 5 (current)"
echo ""

echo "Overclaiming checks:"
check_not_contains "docs/submission.md"   "Casper records the event"
check_not_contains "docs/submission.md"   "Casper Testnet records proof"
check_not_contains "docs/video-script.md" "Casper records every event"
check_not_contains "docs/video-script.md" "Casper records the payment"
check_not_contains "docs/video-script.md" "Casper Testnet: proof recorded"
echo ""

echo "Real vs Mock sections:"
check_contains "README.md"              "What Is Real vs Mock"
check_contains "docs/submission.md"     "What Is Real vs Mock"
echo ""

echo "No fake hashes:"
check_not_contains "docs/submission.md" "0xabc"
echo ""

echo "=== Done: $errors error(s) ==="
exit $errors
