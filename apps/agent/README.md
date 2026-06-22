# Agent Demo — Autonomous Agent Runner

This is the judge-facing terminal demo for CSPR AgentPay Guard. It shows an AI analyst agent autonomously paying for a protected resource through the HTTP 402 flow.

## What It Shows

1. Agent is given a policy: controlled spending budget, merchant allowlist, per-payment max.
2. Agent calls a protected API (premium parking revenue report).
3. API returns `402 Payment Required` with a `PaymentRequirement`.
4. Agent checks policy, authorizes payment.
5. Mock Casper payment moves into escrow.
6. Agent retries with a request-bound receipt.
7. API verifies receipt and returns premium data.
8. Payment is fulfilled and optionally settled.
9. Agent prints a recommendation and full audit trail.

All in mock mode — no real Casper funds move.

## Quick Start

```bash
# Self-contained (starts paid-api in-process)
pnpm --filter @cspr-agentpay/agent demo

# Or with explicit target
AGENTPAY_TARGET_URL=http://127.0.0.1:4000/premium/parking-report/MAD-001 \
  pnpm --filter @cspr-agentpay/agent demo
```

Or against an already running paid-api:

```bash
# Terminal 1
pnpm --filter @cspr-agentpay/paid-api dev

# Terminal 2
AGENTPAY_AUTO_START_PAID_API=false \
  pnpm --filter @cspr-agentpay/agent demo
```

## Expected Output

```
╔══════════════════════════════════════════════════════════════════════╗
║         CSPR AgentPay Guard — Autonomous Agent Demo                ║
╚══════════════════════════════════════════════════════════════════════╝

Objective:
  "Evaluate whether parking lot MAD-001 is worth further RWA due diligence."

Policy:
  Agent:     agent_research_001
  Policy:    policy_demo_agent_001
  Auto-settle: true
  Mode:      mock

Timeline:

  1. Paid API started in-process on port 4000.
  2. Agent starts with objective: fetch premium parking report.
  3. Demo merchant and policy registered.
  4. Agent calls protected resource.
  5. Received HTTP 402 PaymentRequirement.
  6. Authorized payment under policy.
  7. Submitted mock Casper payment into escrow.
  8. Retried protected resource with request-bound receipt.
  9. Received premium data.
  10. Payment fulfilled.
  11. Payment settled.

──────────────────────────────────────────────────────────────────────

Agent recommendation:
  Based on 24h revenue of 12850.00, 87% occupancy,
  average ticket size of 14.20, and confidence score of 0.94,
  the agent recommends further due diligence. This is not investment
  advice; it is a demo of controlled agent spending.

Payment summary:
  paymentId:   abc123...
  proof kind:  mock
  proof hash:  mock-escrowed-...
  responseHash: def456...
  settlement:  settled

══════════════════════════════════════════════════════════════════════
  MOCK MODE — no real Casper funds were moved.
  All proofs use deterministic local mock-* hashes.
══════════════════════════════════════════════════════════════════════

Audit trail:
  • ...
Demo complete.
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AGENTPAY_AGENT_MODE` | `mock` | Mode (mock only). |
| `AGENTPAY_PAID_API_BASE_URL` | `http://127.0.0.1:4000` | Paid API URL (when auto-start=false). |
| `AGENTPAY_AGENT_ID` | `agent_research_001` | Agent identity. |
| `AGENTPAY_POLICY_ID` | `policy_demo_agent_001` | Policy to use. |
| `AGENTPAY_TARGET_URL` | `http://127.0.0.1:4000/premium/parking-report/MAD-001` | Protected resource URL. |
| `AGENTPAY_AUTO_START_PAID_API` | `true` | Start paid-api in-process. |
| `AGENTPAY_AUTO_SETTLE` | `true` | Auto-settle after data retrieval. |
| `AGENTPAY_DEMO_PORT` | `4000` | Port for in-process paid-api. |

## Important

- **Mock mode only.** All proofs use deterministic `mock-*` hashes. No real Casper funds move.
- The agent does not bypass paid-api verification. It uses the same MCP tool handlers as the MCP server.
- The demo is self-contained when `AGENTPAY_AUTO_START_PAID_API=true` (default).
