# CSPR AgentPay Guard

The first guarded native-CSPR Testnet path is available as an explicitly gated local workflow. It uses `casper-js-sdk` 5.0.12, Casper 2.0 TransactionV1, atomic idempotency, and independent RPC verification before the premium endpoint releases data.

```bash
pnpm demo:testnet:guarded:dry-run
```

The dry run reports every missing variable and never submits. See [the runbook](docs/real-guarded-payment-runbook.md) and [payment scheme](docs/casper-payment-scheme.md). The hosted dashboard never loads a signing key or exposes a live-spend button.

CSPR AgentPay Guard is a policy-controlled payment firewall for autonomous AI agents. It demonstrates an HTTP `402 Payment Required` flow where an agent buys a protected API response only when a deterministic policy allows it, while Casper Testnet can anchor the resulting AgentPay proof data on-chain.

This is a Casper Agentic Buildathon project. The local prototype is complete and reliable in mock mode. The Casper component is an Odra `AgentPayProofRecorder` audit/proof anchor, not production escrow, custody, or real CSPR settlement.

The final-round foundation also supports official x402 v2 transport objects and headers through `@x402/core`. A deterministic `GuardedPaymentRequest` policy check runs before any signer or facilitator call. Casper x402 settlement is not yet live because the official x402 SDK currently has no Casper scheme package; real mode fails closed until a verified Casper signer and facilitator are supplied.

## One-Liner

Autonomous agents can pay for protected APIs through HTTP 402, request-bound receipts, allowlists, spending limits, replay protection, and a Casper Testnet proof-recorder path.

## Problem

AI agents increasingly need to buy data, APIs, compute, and services. Today the owner usually has to choose between giving an agent broad wallet access, interrupting every task with a manual checkout, or trusting a centralized prepaid balance. None of those are a good fit for autonomous machine-to-machine commerce.

## Solution

CSPR AgentPay Guard places a payment firewall between the agent and the paid resource. The gateway issues a request-specific `PaymentRequirement`, the agent evaluates an `AgentPolicy`, a Casper-compatible adapter records the payment/proof state, and the paid API releases premium data only after a valid request-bound receipt is presented.

In mock mode, the full journey is deterministic and demoable without funds. In Testnet mode, the deployed `AgentPayProofRecorder` contract records proof fields on Casper so judges can verify the on-chain transaction path.

## Architecture

```text
Autonomous Agent
  -> Protected API / Gateway
  <- 402 Payment Required + PaymentRequirement
  -> Policy Engine checks merchant, resource, amount, budget, expiry, requestHash
  -> Casper Adapter
       - mock mode: deterministic mock proof state machine
       - testnet mode: AgentPayProofRecorder proof anchor
  -> Retry paid API with X-AgentPay-Receipt
  <- Premium response
  -> Dashboard reads audit events and proof metadata
```

Key boundaries:

- `apps/agent`: autonomous demo runner.
- `apps/paid-api`: protected HTTP 402 API and request-bound receipt verification.
- `apps/web`: judge-facing dashboard and audit trail.
- `packages/protocol`: canonical objects, hashes, schemas, proof types.
- `packages/policy`: deterministic policy authorization.
- `packages/casper-adapter`: guarded x402 fetch, deterministic mock settlement, fail-closed real x402/Casper boundary, and Casper proof submission.
- `contracts/agentpay-guard`: Odra proof-recorder contract and generated wasm/schema artifacts.

## Quickstart

```bash
pnpm install
pnpm docs:check
pnpm typecheck
pnpm test
pnpm demo:mock
```

The terminal demo starts the paid API in-process, triggers a `402`, authorizes under policy, retries with a receipt, receives premium data, fulfills, settles the mock payment state, and prints the audit trail.

## Final Round Reviewer Quick Check

- Step-by-step reviewer playbook: [`docs/final-round-playbook.md`](docs/final-round-playbook.md)
- Casper Testnet status and hashes: [`docs/testnet-status.md`](docs/testnet-status.md)
- Demo video: pending; replace with the final public video URL when uploaded.

## Dashboard Demo

```bash
pnpm --filter @cspr-agentpay/web dev

# Browser
open http://localhost:3000/demo
```

Click **Run AgentPay Demo** on the demo page. The dashboard runs a Vercel-safe, self-contained mock AgentPay flow through Next.js API routes, so the public website does not need a separate Express API server. The dashboard is a UI for the mock flow and Testnet proof status; it does not claim that mock hashes are real Casper transactions.

Optional two-server local mode is still available by setting `AGENTPAY_DEMO_BACKEND=external` and running `pnpm --filter @cspr-agentpay/paid-api dev` alongside the web app.

Hosted dashboard: [https://cspr-agentpay-guard.vercel.app](https://cspr-agentpay-guard.vercel.app). A hosted dashboard is useful for judges, but it does not satisfy the Casper Testnet on-chain requirement by itself.

## Casper Testnet Commands

```bash
pnpm proof:testnet:dry-run       # no credentials; prints exact proof payload
pnpm contract:check              # verifies Rust nightly, cargo-odra, wasm target, wasm tools, casper-client
pnpm contract:build              # builds wasm/AgentPayProofRecorder.wasm
pnpm contract:deploy:testnet     # requires funded Testnet key; never fakes deploys
pnpm proof:testnet               # requires deployed contract hash + funded Testnet key
```

`proof:testnet` uses `casper-client put-deploy` to call `record_proof` on the deployed `AgentPayProofRecorder` contract. The committed docs include the successful Testnet deployment and proof transaction hashes; local reproduction still requires your own funded Testnet key.

## Environment Variables

Copy `.env.example` to `.env` for local real-mode work. Never commit `.env` or PEM files.

```bash
AGENTPAY_MODE=mock
CASPER_NETWORK=casper-test
CASPER_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_NODE_SSE_URL=

CASPER_TESTNET_PUBLIC_KEY=<public_key_hex>
CASPER_TESTNET_SECRET_KEY_PATH=/absolute/path/to/secret_key.pem
CASPER_AGENTPAY_CONTRACT_HASH=<contract_hash_after_deployment>
CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=<package_hash_after_deployment>

CASPER_DEPLOY_GAS_MOTES=500000000000
CASPER_PROOF_GAS_MOTES=5000000000
```

Optional CSPR.cloud variables are reserved for future event indexing and are not required for the current proof submission path.
The committed default RPC uses Casper Association's public Testnet node. CSPR.cloud node endpoints require an access token, so only use them when you have configured CSPR.cloud credentials.

## What Is Real vs Mock

| Capability | Status |
|---|---|
| Protocol objects, deterministic hashes, validation schemas | Real |
| Policy engine allowlists, resource scope, per-payment limits, budget checks | Real |
| Paid API HTTP 402 behavior and receipt verification | Real local prototype |
| Request-bound receipt rejection and replay protections | Real local prototype |
| Official x402 v2 transport model and guarded fetch | Real foundation; mock settlement only |
| Casper-capable x402 signer/facilitator | Not implemented; real adapter fails closed |
| Mock Casper adapter state machine | Mock, clearly labeled |
| Dashboard audit trail | Real UI over mock/demo state, Vercel-ready through Next.js API routes |
| `AgentPayProofRecorder` Odra contract source | Real |
| Generated contract wasm and schema | Real, built locally |
| `pnpm proof:testnet:dry-run` | Real dry-run, no transaction submitted |
| `pnpm contract:deploy:testnet` | Real deploy path, executed on Testnet |
| `pnpm proof:testnet` | Real proof path, executed on Testnet |
| Real Casper Testnet deployment hash | `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c` |
| Real Casper Testnet proof transaction hash | `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409` |
| CSPR.click wallet integration | Not implemented |
| CSPR.cloud event indexing | Not implemented |
| Production escrow/custody/settlement | Not implemented |

## Testnet Deployment Status

State: **Deployed on Casper Testnet with one proof transaction submitted**.

| Item | Status |
|---|---|
| Contract source | Done |
| Contract tooling check | Done |
| Contract wasm build | Done |
| Proof dry-run | Done |
| Contract deployed to Casper Testnet | Done |
| Contract hash | `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01` |
| Package hash | `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010` |
| Deployment transaction link | [CSPR.live deploy](https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c) |
| Proof transaction link | [CSPR.live proof](https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409) |

Real Testnet values:

- Contract hash: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- Deployment transaction: `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- Proof transaction: `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`

These hashes are the real Casper Testnet anchors for the current proof-recorder deployment and first AgentPay proof call.

## Security Invariants

- A receipt is valid only for the exact request represented by `requestHash`.
- A payment authorization is bound to one policy, one agent, one merchant, one requirement, and one request hash.
- Policies enforce merchant allowlists before payment authorization.
- Policies enforce per-payment limits and total budget limits before authorization.
- Expired requirements, authorizations, receipts, and policies fail closed.
- Replay protection is enforced by `paymentId`, requirement nonce, receipt nonce, and receipt status.
- Duplicate settlement is rejected.
- Merchants cannot change amount, resource, destination account, or expiry after authorization.
- Dashboard state is derived from backend audit records and proof events, not trusted frontend claims.
- Mock mode is visibly labeled and never presented as real Casper settlement.

## Submission Notes

- GitHub repository: `https://github.com/alsaecas/cspr-agentpay-guard`
- Live demo: `https://cspr-agentpay-guard.vercel.app`
- Demo video: pending; see `docs/video-script.md`.
- DoraHacks submission text: see `docs/submission.md`.
- Final status checklist: see `docs/final-checklist.md`.
- Testnet status and manual deployment steps: see `docs/testnet-status.md`.

## No Production Escrow Disclaimer

CSPR AgentPay Guard does not implement production escrow, custody, or real CSPR settlement. The current Casper contract is an audit/proof recorder for AgentPay proof fields. Mock-mode `mock-*` hashes are deterministic local demo artifacts, not Casper transactions.

## License

MIT License. See `LICENSE`.
