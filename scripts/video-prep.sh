#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat <<EOF
CSPR AgentPay Guard browser recording prep
==========================================

Start the web app before recording:

  cd "$ROOT"
  pnpm --filter @cspr-agentpay/web dev

Then record:

  pnpm video:record

Pages recorded:

  http://localhost:3000/
  http://localhost:3000/judge
  http://localhost:3000/demo

Capture separately during editing:

  pnpm demo:mcp:judge
  the existing CSPR.live payment page
  the existing contract deployment
  the existing proof transaction

Output:

  $ROOT/artifacts/video/cspr-agentpay-browser-demo.webm

Safety reminders:

  - Do not show .env.
  - Do not show private keys or PEM files.
  - Browser scenarios are deterministic and move no funds.
  - Existing Casper payment and Odra proof evidence are read-only.
  - Empty Payments and Audit pages are intentionally excluded.
  - Do not run payment, proof, or deployment commands while recording.
EOF
