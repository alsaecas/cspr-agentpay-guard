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
  http://localhost:3000/payments
  http://localhost:3000/audit

Output:

  $ROOT/artifacts/video/cspr-agentpay-browser-demo.webm

Safety reminders:

  - Do not show .env.
  - Do not show private keys or PEM files.
  - Browser scenarios are deterministic and move no funds.
  - Existing Casper payment and Odra proof evidence are read-only.
  - Do not run payment, proof, or deployment commands while recording.
EOF
