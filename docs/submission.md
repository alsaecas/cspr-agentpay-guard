# DoraHacks Submission — CSPR AgentPay Guard

## Title

CSPR AgentPay Guard

## One-Liner

A policy-controlled payment firewall that lets autonomous AI agents pay for protected APIs through HTTP 402, request-bound receipts, spending limits, replay protection, and a Casper Testnet proof-recorder path.

## Problem

AI agents need to buy APIs, data, compute, and services without stopping for a human checkout every time. Giving an agent unrestricted wallet access is unsafe, while centralized prepaid balances do not provide a transparent, verifiable audit trail. Owners need autonomous payment with enforceable limits and proofs.

## Solution

CSPR AgentPay Guard demonstrates a safe machine-to-machine payment flow:

1. An agent requests a protected API resource.
2. The gateway returns `402 Payment Required` with a `PaymentRequirement`.
3. The agent evaluates an `AgentPolicy`.
4. The policy engine checks merchant allowlist, resource scope, amount, total budget, expiry, nonce, and `requestHash`.
5. The agent submits a payment/proof through the Casper adapter.
6. The agent retries with a request-bound receipt.
7. The paid API verifies the receipt and returns premium data.
8. The dashboard shows the policy decision, receipt, proof metadata, and audit trail.

The local prototype uses a deterministic mock Casper adapter so the full user journey is reliable for judging. The Casper Testnet component is an Odra `AgentPayProofRecorder` contract that records proof data on-chain when deployed; it is an audit anchor, not payable escrow.

## Architecture

```text
apps/agent
  -> apps/paid-api gateway
  <- 402 PaymentRequirement
  -> packages/policy authorization
  -> packages/casper-adapter
       mock: deterministic local proof state machine
       testnet: casper-client proof deploy to AgentPayProofRecorder
  -> apps/paid-api with X-AgentPay-Receipt
  <- premium data
  -> apps/web dashboard audit trail
```

## Demo Commands

```bash
pnpm install
pnpm docs:check
pnpm typecheck
pnpm test
pnpm demo:mock
```

Dashboard:

```bash
pnpm --filter @cspr-agentpay/paid-api dev
pnpm --filter @cspr-agentpay/web dev
# open http://localhost:3000/demo
```

Casper Testnet readiness:

```bash
pnpm proof:testnet:dry-run
pnpm contract:check
pnpm contract:build
pnpm contract:deploy:testnet
pnpm proof:testnet
```

## What Is Real vs Mock

| Feature | Status |
|---|---|
| Protocol types, deterministic serialization, hashes, schemas | Real |
| Policy checks for allowlist, resource, amount, budget, expiry | Real |
| HTTP 402 paid API flow | Real local prototype |
| Request-bound receipt verification | Real local prototype |
| Replay and duplicate settlement tests | Real local prototype |
| Mock Casper adapter | Mock, clearly labeled |
| Dashboard audit UI | Real UI over local demo/audit records |
| AgentPayProofRecorder Odra contract source | Real |
| Generated wasm and schema artifacts | Real |
| `proof:testnet:dry-run` | Real dry-run; no transaction submitted |
| Real Casper Testnet deployment | Pending credentials and Testnet gas |
| Real Casper Testnet proof transaction | Pending deployed contract hash |
| CSPR.click integration | Not implemented |
| CSPR.cloud indexing | Not implemented |
| Production escrow, custody, or settlement | Not implemented |

## Testnet Proof Status

State: **Deployment pending credentials and Testnet gas**.

Confirmed locally:

- `pnpm proof:testnet:dry-run` passes and prints the exact proof fields.
- `pnpm contract:check` passes with Rust nightly, cargo-odra, wasm target, Binaryen, WABT, and `casper-client`.
- `pnpm contract:build` passes and produces `contracts/agentpay-guard/wasm/AgentPayProofRecorder.wasm`.
- `pnpm contract:deploy:testnet` exists and fails safely when Testnet credentials are missing.
- `pnpm proof:testnet` exists and fails safely when credentials or contract hash are missing.

Pending:

- Contract hash: pending
- Deployment transaction link: pending
- Proof transaction link: pending

Do not present this as a real Casper Testnet transaction yet. The repository is ready for a human with a funded Testnet key to deploy the contract and submit the first proof.

## Security Invariants

- Receipts are valid only for the exact request represented by `requestHash`.
- Payment authorization is bound to one policy, agent, merchant, requirement, and request hash.
- Merchant allowlists are enforced before payment authorization.
- Per-payment and total budget limits are enforced before authorization.
- Expired policies, requirements, authorizations, and receipts fail closed.
- Replay protection is enforced by `paymentId`, requirement nonce, receipt nonce, and receipt status.
- Duplicate settlement is rejected.
- Mock proofs are visibly labeled and never presented as Casper transactions.

## Roadmap

1. Deploy `AgentPayProofRecorder` to Casper Testnet with a funded Testnet key.
2. Submit one real proof transaction through `pnpm proof:testnet`.
3. Record the contract hash, deployment link, and proof link in the docs.
4. Add CSPR.cloud event reads after a real contract exists.
5. Add CSPR.click only for policy owner setup/funding, not per-payment human checkout.
6. Explore production-grade escrow as future work after the proof-recorder demo is complete.

## No Production Escrow Disclaimer

CSPR AgentPay Guard does not implement production escrow, custody, or real CSPR settlement. The Casper contract is an audit/proof anchor for AgentPay proof fields. Mock-mode `mock-*` hashes are deterministic local artifacts, not Casper transactions.
