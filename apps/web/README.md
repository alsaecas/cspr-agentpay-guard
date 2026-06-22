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
# Terminal 1: Start the paid API
pnpm --filter @cspr-agentpay/paid-api dev

# Terminal 2: Start the dashboard
pnpm --filter @cspr-agentpay/web dev

# Browser: http://localhost:3000
# Click "Run Dashboard Demo" on the /demo page
```

## Troubleshooting

If the dashboard shows "Paid API unreachable":

1. Make sure the paid API is running: `pnpm --filter @cspr-agentpay/paid-api dev`
2. Check the base URL in `.env`: `AGENTPAY_PAID_API_BASE_URL=http://127.0.0.1:4000`
3. The terminal demo also works standalone: `pnpm demo:mock`

## Mock Mode

All proofs use deterministic `mock-*` hashes. Every page displays a **MOCK MODE** badge. No real Casper funds are moved.

## Architecture

- Next.js App Router
- API routes proxy to paid-api (no CORS, no direct browser-to-paid-api calls)
- Client components fetch from `/api/agentpay/*` routes
- Dark theme with `globals.css` CSS custom properties
