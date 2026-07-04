#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cat <<EOF
CSPR AgentPay Guard browser recording prep
==========================================

Start these in separate terminals before recording:

  cd "$ROOT"
  pnpm --filter @cspr-agentpay/paid-api dev

  cd "$ROOT"
  pnpm --filter @cspr-agentpay/web dev

Then record:

  pnpm video:record

Pages recorded:

  http://localhost:3000/demo
  http://localhost:3000/payments
  http://localhost:3000/audit
  https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c
  https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409

Output:

  $ROOT/artifacts/video/cspr-agentpay-browser-demo.webm

Safety reminders:

  - Do not show .env.
  - Do not show private keys or PEM files.
  - Payment execution in the browser demo is mock mode.
  - The Casper Testnet proof transaction is real.
  - Do not describe this as production escrow, custody, or real CSPR settlement.
EOF
