#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

errors=0

fail() {
  echo "FAIL: $1"
  errors=$((errors + 1))
}

pass() {
  echo "OK: $1"
}

tracked_files="$(git ls-files)"

tracked_env="$(
  printf '%s\n' "$tracked_files" |
    grep -E '(^|/)\.env($|\.)' |
    grep -vE '(^|/)\.env\.example$' || true
)"
if [ -n "$tracked_env" ]; then
  fail "tracked .env-like files found"
  printf '%s\n' "$tracked_env"
else
  pass "no tracked .env files"
fi

tracked_pem="$(
  printf '%s\n' "$tracked_files" |
    grep -Ei '\.(pem|key|secret)$' || true
)"
if [ -n "$tracked_pem" ]; then
  fail "tracked PEM/key/secret-looking files found"
  printf '%s\n' "$tracked_pem"
else
  pass "no tracked PEM/key/secret-looking files"
fi

tracked_private="$(
  printf '%s\n' "$tracked_files" |
    grep -Ei '(^|/)(id_rsa|id_dsa|id_ecdsa|id_ed25519|wallet|.*private.*key.*|secrets?/|keys?/)' || true
)"
if [ -n "$tracked_private" ]; then
  fail "tracked private-key/wallet/secret-path files found"
  printf '%s\n' "$tracked_private"
else
  pass "no tracked private-key/wallet/secret-path files"
fi

for required in \
  ".github/workflows/ci.yml" \
  ".github/workflows/codeql.yml" \
  ".github/dependabot.yml" \
  "SECURITY.md"; do
  if [ -f "$required" ]; then
    pass "$required exists"
  else
    fail "$required is missing"
  fi
done

echo "Security check complete: $errors error(s)"
exit "$errors"
