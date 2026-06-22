# MCP Server — Agent-Facing Tool Surface

This package exposes CSPR AgentPay Guard as an MCP (Model Context Protocol) server that AI agents can use to safely call paid HTTP 402 resources.

## What It Does

An AI agent can:

1. Ask the MCP server to call a protected resource.
2. The MCP server calls the URL, receives `402 Payment Required`.
3. Parses the `PaymentRequirement`.
4. Calls the paid API's demo authorization helper to authorize and escrow payment.
5. Retries the protected URL with `X-AgentPay-Receipt`.
6. Returns premium data plus payment proof and audit timeline.
7. Optionally settles the payment.

**All in mock mode.** No real Casper Testnet connection is needed. Every receipt uses `kind: "mock"` proofs.

## Available Tools

| Tool | Description |
|---|---|
| `agentpay_status` | Server status, config, paid-api health check, available tools list. |
| `setup_demo` | Initialize/reset paid API demo state (merchant + policy). |
| `call_paid_resource` | Full 402 → authorize → retry → premium data flow. |
| `authorize_requirement` | Authorize and escrow a single PaymentRequirement. |
| `settle_payment` | Settle a fulfilled payment by paymentId. |
| `get_audit_timeline` | Retrieve ordered audit events, optionally filtered by paymentId. |

## Quick Start

```bash
# Terminal 1: Start the paid API
pnpm --filter @cspr-agentpay/paid-api dev

# Terminal 2: Start the MCP server over stdio
pnpm --filter @cspr-agentpay/mcp-server dev
```

The MCP server starts on stdio and waits for MCP client connections.

## Example: call_paid_resource

Input:
```json
{
  "url": "http://127.0.0.1:4000/premium/parking-report/MAD-001",
  "autoSettle": true
}
```

Output includes:
- `resource` — premium parking-lot data
- `paymentRequirement` — the 402 requirement
- `authorization` — the payment authorization
- `receipt` — escrowed mock receipt
- `proof` — `{ kind: "mock", hash: "...", eventId: "..." }`
- `auditEvents` — ordered audit trail
- `timeline` — judge-readable step-by-step timeline
- `settlement` — settlement result (if autoSettle=true)

## Example: authorize_requirement

If the agent wants to fetch the resource itself:

1. Agent makes GET request to paid API → receives 402.
2. Agent passes the `paymentRequirement` to `authorize_requirement`.
3. MCP server authorizes and returns an escrowed receipt.
4. Agent retries the URL with `X-AgentPay-Receipt: <receipt JSON>`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AGENTPAY_MCP_TRANSPORT` | `stdio` | Transport mode (`stdio` or `streamable-http`). |
| `AGENTPAY_PAID_API_BASE_URL` | `http://127.0.0.1:4000` | Paid API base URL. |
| `AGENTPAY_DEFAULT_POLICY_ID` | `policy_demo_agent_001` | Default policy for authorization. |
| `AGENTPAY_DEFAULT_AGENT_ID` | `agent_research_001` | Default agent identity. |
| `AGENTPAY_AUTO_SETUP` | `true` | Auto-initialize demo state before calls. |
| `AGENTPAY_AUTO_SETTLE` | `false` | Auto-settle after successful retrieval. |

## Important Boundaries

- MCP does **not** duplicate paid-api verification logic.
- MCP calls the paid-api HTTP endpoints for the end-to-end demo flow.
- MCP does **not** directly mutate adapter internals.
- MCP reuses protocol schemas to validate received objects.
- Paid API remains the owner of HTTP 402 requirement generation and receipt verification.
- All receipts use mock proofs — no real Casper settlement.

## Implementation Status

- ✅ 7 MCP tools fully implemented over mock mode.
- ✅ Full 402 → authorize → retry → premium data flow.
- ✅ Judge-readable timeline output.
- ✅ Auto-setup and auto-settle support.
- ⬜ Streamable HTTP transport (local stdio for now).
- ⬜ Real Casper Testnet mode (planned for Prompt 10).
