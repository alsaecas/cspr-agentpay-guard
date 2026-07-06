# Dashboard — Judge-Facing Audit UI

This is the visible audit trail for CSPR AgentPay Guard. It shows policy, payments, merchants, proof, and the demo flow in a polished dark "agent operations center" UI.

## What It Shows

- **Home** — hero, how-it-works, quick links
- **Demo** — Run AgentPay button: full 402 → authorize → retry → settle flow with visual timeline and result cards
- **Policies** — Current demo policy details
- **Payments** — Payment events table with status badges
- **Merchants** — Registered merchant details
- **Audit** — Ordered audit timeline + raw event table with paymentId filter

## Quick Start

```bash
pnpm --filter @cspr-agentpay/web dev

# Browser: http://localhost:3000
# Click "Run Dashboard Demo" on the /demo page
```

The default dashboard backend is self-contained: Next.js API routes execute the
full mock AgentPay flow, so the interactive demo works on Vercel without a
separate Express server.

Production URL: [https://cspr-agentpay-guard.vercel.app](https://cspr-agentpay-guard.vercel.app)

Optional external paid API mode:

```bash
# Terminal 1
AGENTPAY_DEMO_BACKEND=external pnpm --filter @cspr-agentpay/paid-api dev

# Terminal 2
AGENTPAY_DEMO_BACKEND=external pnpm --filter @cspr-agentpay/web dev
```

## Troubleshooting

If you intentionally set `AGENTPAY_DEMO_BACKEND=external` and the dashboard
shows "Paid API unreachable":

1. Make sure the paid API is running: `pnpm --filter @cspr-agentpay/paid-api dev`
2. Check the base URL in `.env`: `AGENTPAY_PAID_API_BASE_URL=http://127.0.0.1:4000`
3. The terminal demo also works standalone: `pnpm demo:mock`

## Mock Mode

All proofs use deterministic `mock-*` hashes. Every page displays a **MOCK MODE** badge. No real Casper funds are moved.

## Architecture

- Next.js App Router
- API routes run the mock demo flow directly by default
- External mode can proxy to paid-api for local two-server testing
- Client components fetch from `/api/agentpay/*` routes
- Dark theme with `globals.css` CSS custom properties
