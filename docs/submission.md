# Submission — CSPR AgentPay Guard

## Project Title

**CSPR AgentPay Guard** — Policy-Controlled Payment Firewall for Autonomous AI Agents

## One-Liner

Autonomous AI agents pay for protected APIs through HTTP 402 with policy limits, request-bound receipts, escrow, and audit trails — all anchored on Casper.

## Problem

AI agents increasingly need to buy APIs, data, compute, and services. Today's choices are unsafe: give agents unrestricted wallet access, require human checkout, or use centralized prepaid balances. Agents need payment autonomy, but owners need enforceable limits, replay protection, and audit trails.

## Solution

CSPR AgentPay Guard is a Casper-powered payment firewall. An agent calls a paid API, receives HTTP 402 Payment Required, checks its spending policy (merchant allowlist, per-payment max, total budget), authorizes exactly one request-bound payment, retries with a receipt, and receives premium data. The mock adapter records the full payment state machine. The merchant settles. The dashboard shows the full audit trail. An on-chain proof recorder contract is ready for Testnet deployment.

## Architecture

```
Agent → GET /premium/parking-report/MAD-001
         ← 402 Payment Required + PaymentRequirement
Agent → Check policy → Authorize payment
         → Mock adapter escrows payment
         → Retry with X-AgentPay-Receipt
         ← 200 Premium data + responseHash
Agent → Print recommendation + audit trail
```

## Demo Commands

```bash
# Full local mock demo (terminal)
pnpm demo:mock

# Dashboard demo
# Terminal 1: pnpm --filter @cspr-agentpay/paid-api dev
# Terminal 2: pnpm --filter @cspr-agentpay/web dev
# Browser: http://localhost:3000/demo → Run AgentPay Demo

# Testnet proof dry-run (always works)
pnpm proof:testnet:dry-run

# Contract check
pnpm contract:check
```

## What Is Real vs Mock

| Feature | Status |
|---|---|
| Protocol types, hashes, schemas | ✅ Real (shared by both modes) |
| Policy engine (pure function) | ✅ Real |
| Mock adapter (full state machine) | ✅ Mock-only |
| Paid API HTTP 402 flow | ✅ Mock-only |
| MCP server (6 tools) | ✅ Mock-only |
| Agent demo (terminal) | ✅ Mock-only |
| Dashboard (6 pages, dark theme) | ✅ Mock-mode display |
| `pnpm proof:testnet:dry-run` | ✅ Works (no credentials) |
| `pnpm proof:testnet` | ✅ Graceful exit with setup instructions |
| `AgentPayProofRecorder` Odra contract | ✅ Source complete, compiles |
| Contract compilation (`cargo check`) | ✅ Passes (Odra 2.8.1, nightly Rust) |
| Contract deployment to Casper Testnet | ⬜ Pending credentials + `cargo odra deploy` |
| Real Casper Testnet transaction | ⬜ Pending deployment |
| CSPR.click wallet | ⬜ Not implemented |
| CSPR.cloud event reads | ⬜ Pending deployed contract events |
| Production escrow/custody | ⬜ Not implemented |

## Testnet Proof Status

The `AgentPayProofRecorder` Odra contract compiles and is ready for deployment. It records `paymentId`, `requestHash`, `policyId`, `merchantId`, `status`, and optional `receiptHash` on-chain with duplicate rejection, status validation, and CES event emission.

See `docs/testnet-status.md` for exact deployment steps.

## Security Invariants

- Receipts valid only for the exact request represented by `requestHash` (BLAKE2b-256).
- Payments identified by deterministic `paymentId`.
- Policies enforce merchant allowlists, per-payment limits, total budgets, expiry, and resource scope.
- Duplicate settlement rejected.
- Requirement, authorization, receipt nonce, and payment ID replay rejected.
- Mock mode and real Casper mode share the same protocol surface.
- Mock mode clearly labeled; never presented as real Casper settlement.

## Future Roadmap

1. Deploy `AgentPayProofRecorder` to Casper Testnet.
2. Submit a real proof via `pnpm proof:testnet`.
3. Read indexed events from CSPR.cloud.
4. Add CSPR.click wallet for policy owner funding.
5. Production-grade escrow and settlement.
6. Multi-merchant demo.

## No Production Escrow Disclaimer

**This project does not implement production escrow, custody, or real CSPR settlement. All mock proofs use deterministic `mock-*` hashes. The `AgentPayProofRecorder` contract is an audit anchor — not a payable escrow contract.**
