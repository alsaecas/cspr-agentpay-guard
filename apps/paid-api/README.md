# Paid API — HTTP 402 Protected Resource Demo

This app implements the HTTP 402 Payment Required flow for CSPR AgentPay Guard. It serves premium parking-lot reports that can only be accessed by providing a valid Casper AgentPay receipt.

## Architecture

```
Client/Agent → GET /premium/parking-report/MAD-001
                 ← 402 Payment Required + PaymentRequirement
                 → POST /demo/authorize + POST /demo/settle
                 ← escrowed receipt
Client/Agent → GET /premium/parking-report/MAD-001
                 X-AgentPay-Receipt: <escrowed receipt JSON>
                 ← 200 premium report with responseHash
```

## Mock Mode (default)

The server uses the `MockCasperPaymentAdapter` for a fully local, deterministic demo. No Casper Testnet connection is needed. Every mock proof uses `mock-*` prefixed hashes and is clearly labeled.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check. Returns mode and service name. |
| `POST` | `/demo/setup` | Initialize demo state (merchant, policy). Idempotent. |
| `GET` | `/premium/parking-report/:lotId` | Protected resource. Returns 402 without receipt, premium data with valid receipt. |
| `POST` | `/demo/authorize` | Demo helper: authorize + escrow a payment for a requirement. |
| `POST` | `/demo/settle/:paymentId` | Demo helper: settle a fulfilled payment. |
| `GET` | `/demo/audit` | Return all audit events from the adapter. |

## Receipt Verification

**Receipts are request-bound.** A receipt issued for one exact URL cannot be reused for another. The server rebuilds the `requestHash` from the current HTTP request (method, URL, endpointId, nonce, etc.) and compares it to the receipt's `requestHash`. Using a MAD-001 receipt on BCN-001 returns `REQUEST_HASH_MISMATCH`.

Before releasing premium data, the server verifies:

1. Receipt JSON parses and validates against `PaymentReceiptSchema`.
2. The receipt's `requestHash` matches an issued requirement.
3. The receipt's `merchantId`, `endpointId`, `amount`, and `currency` match the requirement.
4. The requirement has not expired.
5. The receipt status is `escrowed`, `fulfilled`, or `settled`.
6. In mock mode, `proof.kind` is `"mock"`.
7. The adapter confirms the `paymentId` exists with an acceptable status.

If any check fails, the server returns a specific error code (`MALFORMED_RECEIPT`, `REQUEST_HASH_MISMATCH`, `MERCHANT_MISMATCH`, etc.).

## Quick Demo (curl)

```bash
# Start the server
pnpm --filter @cspr-agentpay/paid-api dev

# Initialize demo state
curl -s -X POST http://localhost:4000/demo/setup | jq .

# Request premium data → get 402
curl -s -i http://localhost:4000/premium/parking-report/MAD-001

# Capture the 402 response body and authorize payment
REQ=$(curl -s http://localhost:4000/premium/parking-report/MAD-001 | jq '.paymentRequirement')
curl -s -X POST http://localhost:4000/demo/authorize \
  -H "Content-Type: application/json" \
  -d "{\"policyId\":\"policy_demo_agent_001\",\"agentId\":\"agent_research_001\",\"requirement\":$REQ}" | jq .

# Use the receipt to access premium data
RECEIPT=$(curl -s -X POST http://localhost:4000/demo/authorize \
  -H "Content-Type: application/json" \
  -d "{\"policyId\":\"policy_demo_agent_001\",\"agentId\":\"agent_research_001\",\"requirement\":$REQ}" | jq -c '.receipt')
curl -s -H "X-AgentPay-Receipt: $RECEIPT" http://localhost:4000/premium/parking-report/MAD-001 | jq .

# Settle the payment
PAYMENT_ID=$(echo $RECEIPT | jq -r '.paymentId')
curl -s -X POST http://localhost:4000/demo/settle/$PAYMENT_ID | jq .
```

## Environment

Copy `.env.example` to `.env`. All defaults work for mock mode.

## Premium Lots

| Lot ID | Location |
|---|---|
| `MAD-001` | Madrid |
| `BCN-001` | Barcelona |
| `VAL-001` | Valencia |

## Implementation Status

- ✅ Mock mode fully functional with all security checks.
- ✅ Demo helper endpoints (authorize, settle) for agent-less testing.
- ⬜ Real Casper Testnet mode (planned for Prompt 10).
- ⬜ Gateway integration (planned for Prompt 6 completion).

This app does **not** claim real Casper settlement. All receipts use `kind: "mock"` and `mock-*` proof hashes.
