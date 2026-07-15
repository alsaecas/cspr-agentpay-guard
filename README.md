# CSPR AgentPay Guard

> x402 is the payment rail. AgentPay Guard is the authorization layer.

CSPR AgentPay Guard is a zero-trust firewall for AI wallets. An autonomous agent may buy a protected API response only after deterministic policy binds the exact merchant, payee, resource, amount, budget, expiry, request integrity, and replay state.

One real policy-authorized native-CSPR payment has already completed exactly once on Casper Testnet. Premium MAD-001 RWA data was released only after independent Casper RPC verification. [Inspect the public evidence](docs/evidence/first-guarded-testnet-payment.md).

## Judge Mode

- Production: [cspr-agentpay-guard.vercel.app](https://cspr-agentpay-guard.vercel.app)
- Dedicated route after this milestone is deployed: `/judge`
- Interactive deterministic scenarios: `/demo`
- Two-minute review path: [final-round playbook](docs/final-round-playbook.md)
- Requirements and evidence: [requirements matrix](docs/hackathon-requirements-matrix.md)

Judge Mode explains the product without requiring this README. It shows the allowed MAD-001 request, prompt-injection/payee substitution denial, replay rejection, verified Testnet payment, MCP agent interface, separate Odra proof recorder, and the hosted no-spend boundary.

## One-liner

A zero-trust authorization layer for x402 that lets autonomous AI agents buy protected APIs under deterministic policy and independently verified Casper settlement.

## Agentic RWA story

1. An autonomous due-diligence agent requests premium data for tokenized parking asset MAD-001.
2. The provider responds with HTTP 402 and an authoritative payment requirement.
3. AgentPay Guard reconstructs the requirement instead of trusting model-provided payment fields.
4. Ordered policy checks return ALLOW or a stable denial code.
5. Only a valid real request may cross the local signer boundary.
6. The resource server independently verifies Casper execution before releasing premium data.

The hosted application demonstrates the decisions with deterministic scenarios. It never loads a private key, invokes a signer, submits a transaction, or moves funds.

## Architecture

```text
MCP-compatible RWA agent
  -> protected API
  <- HTTP 402 + PAYMENT-REQUIRED
  -> AgentPay Guard deterministic policy
       merchant · payee · resource · amount · budget
       integrity · expiry · nonce · replay
  -> local Casper payment boundary (real path only)
  -> independent Casper RPC verification
  -> PAYMENT-SIGNATURE / PAYMENT-RESPONSE
  <- premium MAD-001 data
  -> audit store and Judge Mode
```

Components:

- `apps/agent`: autonomous demo runner.
- `apps/paid-api`: protected resource, x402 behavior, and verification boundary.
- `apps/web`: homepage, Judge Mode, deterministic demo, and audit views.
- `packages/mcp-server`: project-owned MCP server built with the official Model Context Protocol SDK.
- `packages/policy`: deterministic authorization rules.
- `packages/protocol`: versioned schemas and deterministic hashes.
- `packages/casper-adapter`: mock-compatible adapter plus guarded native-CSPR Testnet path.
- `contracts/agentpay-guard`: separate Odra `AgentPayProofRecorder`.

## MCP judge workflow

```bash
pnpm install
pnpm demo:mcp:judge
```

The command starts an actual MCP server and client over an SDK-supported transport. Its tools execute the existing `guardedFetch` path: x402 requirement decoding, normalization, real policy evaluation, an injected no-spend settlement adapter, PAYMENT-SIGNATURE retry, PAYMENT-RESPONSE verification, and deterministic premium response. It does not require the paid API, a private key, or Testnet credentials.

First-class tools:

- `agentpay_run_rwa_due_diligence`
- `agentpay_evaluate_payment`
- `agentpay_get_verified_testnet_payment`
- `agentpay_security_model`

Older deterministic lifecycle tools remain for backward compatibility and are labeled as demo tools.

## Quickstart

```bash
pnpm install
pnpm docs:check
pnpm typecheck
pnpm test
pnpm demo:mcp:judge
pnpm --filter @cspr-agentpay/web dev
```

Open `http://localhost:3000/judge`. The route works without secrets or an external paid API.

## What Is Real vs Mock

| Capability | Boundary |
|---|---|
| Deterministic policy engine and request binding | Real implementation |
| Official x402 v2 transport through `@x402/core` | Real implementation |
| Native-CSPR payment payload | Project-specific scheme; not an official Casper x402 standard |
| MCP interface | Project-owned server using the official MCP SDK |
| Hosted Judge Mode and interactive scenarios | Deterministic, safe, no-spend |
| Guarded Testnet payment | One real, independently verified native TransactionV1 |
| Odra proof recorder | Separate real public audit/proof path |
| Production custody, payable escrow, Mainnet, security audit | Not implemented or claimed |

## Verified Casper evidence

### Guarded payment

- Transaction: [`801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f`](https://testnet.cspr.live/transaction/801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f)
- Amount: 2.5 CSPR
- Network: `casper-test`
- Block: 8510676
- Execution: succeeded
- Submission: exactly once
- Premium response: released after verification

### Separate Odra proof recorder

- Contract: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- Deployment: [`b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`](https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c)
- Existing proof: [`9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`](https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409)

The payment and proof are separate transactions. The proof recorder does not transfer CSPR and is not settlement, escrow, or custody.

## x402 accuracy

The real guarded path is:

```text
PAYMENT-REQUIRED
-> deterministic authorization
-> native-CSPR TransactionV1
-> independent RPC verification
-> PAYMENT-SIGNATURE
-> HTTP 200
-> PAYMENT-RESPONSE
```

The transport uses official x402 v2 objects and headers. The `agentpay-casper-native-v1` payload is project-specific and is not presented as an official Casper x402 scheme.

## Security invariants

- Model output cannot select an arbitrary payee.
- A receipt or payment is valid only for the exact request hash.
- Merchant allowlists run before authorization.
- Per-payment and total budget limits run before signing.
- Expired requirements, authorizations, receipts, and policies fail closed.
- Unknown execution state never becomes success.
- Payment IDs, nonces, and consumed transactions enforce replay protection.
- A payment may be settled or consumed at most once.
- Hosted mode contains no keys and cannot initiate spending.
- Dashboard facts come from deterministic backend state or committed public evidence, not frontend claims.

## Validation

See the latest CI for current status. High-risk paths cover policy allow/deny, request binding, expiry, budget, duplicate settlement, deterministic Casper events, guarded Testnet verification, MCP client/server handshake, no-spend guarantees, and rendered Judge Mode content.

## Final submission package

- [DoraHacks copy](docs/dorahacks-final-update.md)
- [Submission summary](docs/submission.md)
- [Requirements matrix](docs/hackathon-requirements-matrix.md)
- [Final checklist](docs/final-checklist.md)
- [Video script](docs/video-script.md)
- [Video shot list](docs/video-shot-list.md)
- [Recording runbook](docs/video-recording-runbook.md)
- Final video URL: `[ADD AFTER MANUAL UPLOAD]`

## Honest limitations

This is a Casper Testnet hackathon prototype. It is not a security audit, Mainnet release, custody product, payable escrow system, or production settlement service. It does not claim an official Casper x402 scheme or official Casper MCP server.

## License

MIT License. See [LICENSE](LICENSE).
