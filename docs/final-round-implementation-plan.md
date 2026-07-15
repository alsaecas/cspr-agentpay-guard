# Final-Round Implementation Plan

Last updated: 2026-07-14

## Current-State Architecture

The repository is a TypeScript pnpm monorepo with an Odra contract workspace:

```text
agent / MCP client
  -> Express or self-contained Next.js paid resource
  <- custom HTTP 402 PaymentRequirement
  -> deterministic policy engine
  -> mock Casper payment state machine
  -> retry with X-AgentPay-Receipt
  <- premium response
  -> optional AgentPayProofRecorder call on Casper Testnet
```

`packages/protocol` owns canonical serialization, hashes, schemas, and shared
objects. `packages/policy` owns deterministic authorization. `apps/paid-api`
owns the protected resource and receipt verification. `packages/casper-adapter`
owns mock payment state and the guarded proof submission CLI. `apps/web` reads
backend-derived demo state. The Odra contract is a proof recorder, not a payment
or custody contract.

## Investigation Results

### Genuinely real today

- Deterministic protocol serialization, Blake2b-256 hashes, validation, policy
  evaluation, request-bound receipt checks, replay checks, and duplicate
  settlement checks are executable code with tests.
- The Express and self-contained Next.js paths perform a real local HTTP 402
  request/retry exchange.
- `AgentPayProofRecorder` is deployed on Casper Testnet. The deployment and one
  `record_proof` call are linked in `docs/testnet-status.md`.
- The proof submission command uses `casper-client`; it reports a transaction
  only when the CLI returns a real 64-character hash.
- Milestone 1 adds official x402 v2 transport objects and headers, normalized
  `GuardedPaymentRequest`, deterministic guard traces, a guarded fetch pipeline,
  and a fail-closed real integration boundary.

### Currently simulated or incomplete

- Interactive payment authorization, signing, funds movement, settlement, and
  payment lifecycle events are deterministic local mock behavior.
- The existing broad demo uses a custom `PaymentRequirement` and
  `X-AgentPay-Receipt`; it has not yet migrated to the official x402 headers.
- The official x402 SDK has no Casper scheme/network package. The new real
  adapter therefore requires an injected, independently verified Casper signer
  and Casper-capable facilitator and otherwise refuses to sign or settle.
- The proof recorder stores one immutable record per `paymentId`, has no recorder
  allowlist, and does not prove that CSPR moved.
- CSPR.cloud indexing, CSPR.click, payable escrow, production custody, and
  mainnet settlement are not implemented.

## Highest-Impact Gaps

1. Implement and publish a reviewed Casper `exact` x402 scheme binding, including
   a canonical signed payload and CAIP-compatible network identifier.
2. Run or integrate a facilitator that advertises and verifies that exact
   `(scheme, network)` pair before accepting any live requirement.
3. Submit a real Testnet CSPR transfer only after policy ALLOW, wait for execution,
   and verify destination, amount, network, and transfer identifier from a Casper
   node before releasing the resource.
4. Move the paid API from custom headers to official x402 v2 while preserving a
   clearly labelled compatibility path during migration.
5. Add recorder access control or signed proof permits and a lifecycle/event
   model that does not conflict with one-record-per-payment storage.
6. Add Judge Mode UI controls and a real Testnet run only after the settlement
   path has independently verifiable evidence.

## Official Casper/x402 Integration Path

The foundation uses the official `@x402/core` v2 types and codecs. The resource
returns Base64 JSON in `PAYMENT-REQUIRED`; the client selects one `accepts[]`
entry; the guard normalizes it and evaluates policy; an x402 scheme signer
creates `PaymentPayload`; the retry sends `PAYMENT-SIGNATURE`; the resource or
facilitator verifies and settles; and the final response includes
`PAYMENT-RESPONSE`.

Casper support must be implemented as an x402 scheme/network binding, not by
renaming a mock receipt. The intended real path is:

1. Define a Casper `exact` scheme payload that binds payer, `payTo`, amount in
   motes, asset, chain name, nonce/transfer ID, request hash, and expiry.
2. Implement the official `SchemeNetworkClient`, `SchemeNetworkServer`, and
   `SchemeNetworkFacilitator` contracts from `@x402/core` for Casper.
3. Build and sign a Casper 2.0 native transfer using a single verified Casper SDK
   generation or a reviewed `casper-client put-transaction transfer` boundary.
4. Have `/verify` validate the signature and every signed field without mutation.
5. Have `/settle` submit once, track the signed payload as in-flight, wait for
   execution, and return the real transaction hash only after node confirmation.
6. Have the resource independently verify network, payer, payee, amount, asset,
   transfer ID, execution success, and request binding before returning data.
7. Optionally record a separate proof anchor after settlement; never treat the
   proof-recorder transaction as payment evidence.

Primary references:

- x402 v2 HTTP headers: https://docs.x402.org/core-concepts/http-402
- x402 client/server flow: https://docs.x402.org/core-concepts/client-server
- x402 reference SDK and specification: https://github.com/x402-foundation/x402
- Casper 2.0 transaction construction: https://docs.casper.network/condor/transactions

`casper:casper-test` is currently a project-local identifier. It must not be
claimed as a registered x402/CAIP network identifier until that registration or
binding is confirmed.

## Milestones and Acceptance Criteria

### Milestone 1 — Guarded x402 foundation

Status: implemented in this branch.

Acceptance criteria:

- Official x402 v2 `PaymentRequired`, `PaymentPayload`, and settlement header
  transport is preserved.
- `GuardedPaymentRequest` binds method, normalized URL, body/request hashes,
  provider, merchant, payee, network, asset, amount, nonce, time bounds, and the
  original payload.
- Policy returns stable ALLOW/DENY reasons and a judge-safe check trace.
- No signer or settlement method is called after denial.
- Mock settlement remains visibly mock; real mode returns no invented hash.
- Allowed, tampering, over-budget, expiry, replay, duplicate settlement, and
  facilitator cases are tested.

### Milestone 2 — Casper exact-scheme prototype

Acceptance criteria:

- A versioned Casper x402 scheme specification and fixtures exist.
- Signer, verifier, and settlement code use one documented Casper SDK/CLI path.
- Keys remain outside protocol/policy packages and are never logged.
- Verification rejects every mutated signed field and unsupported network/asset.
- Dry-run produces a payload but never a transaction-looking hash.

### Milestone 3 — Real Testnet settlement

Acceptance criteria:

- A funded agent account submits a real CSPR Testnet transfer after ALLOW.
- A node/explorer independently confirms execution, payee, amount, network, and
  transfer identifier.
- Duplicate concurrent settlement is rejected.
- The protected API returns premium data only after confirmation.
- Missing configuration fails with exact setup guidance and mock mode still runs.

### Milestone 4 — Resource and MCP migration

Acceptance criteria:

- Paid API and MCP client use official x402 headers end to end.
- The compatibility path is labelled and removable.
- Request URL, method, body, nonce, and settlement evidence remain bound.
- All existing mock and receipt security tests still pass.

### Milestone 5 — Judge Mode and proof hardening

Acceptance criteria:

- Dashboard exposes the three named scenarios and every deterministic check.
- Mock and Testnet modes are visually unmistakable.
- Real transaction links appear only for verified real hashes.
- Recorder authorization/lifecycle limitations are fixed or explicitly excluded.

## Security Risks

- A malicious 402 can alter amount or payee; exact policy allowlists and expected
  price binding must run before signing.
- Prompt or tool output can influence agent intent; it cannot influence guard
  configuration or override a denial.
- A signed payload may be replayed concurrently; nonce and in-flight settlement
  stores need atomic, durable checks in real mode.
- A facilitator can lie or be compromised; the resource must verify settlement
  evidence independently before releasing value.
- URL normalization or body serialization drift can create hash confusion; all
  participants must share canonical fixtures.
- The current proof recorder permits any caller and cannot record lifecycle
  transitions for the same payment ID.
- A local in-memory budget/replay store is not safe across processes or restarts.

## Migration Risks

- Running custom and official header paths simultaneously can cause downgrade or
  ambiguity. The selected protocol version must be explicit in audit events.
- Existing endpoint IDs are part of request hashes; changing defaults requires
  protocol docs and fixture migrations.
- Official x402 package shapes and network support can change. Versions are pinned
  through the lockfile and should be upgraded only with wire-fixture tests.
- Casper 2.0 prefers TransactionV1 while the proof recorder still uses a legacy
  deploy CLI path. Payment and proof evidence must remain separately typed.

## Test Strategy

- Unit-test canonical serialization, normalization, schema rejection, policy
  ordering, and reason codes.
- Use adversarial table tests for each mutated requirement field.
- Spy on signer/facilitator calls to prove denial has no settlement side effect.
- Test replay and duplicate settlement sequentially and concurrently before real
  Testnet use.
- Contract tests cover recorder validation; Testnet tests remain credential-gated.
- Run docs, typecheck, workspace tests, contract tests, proof dry-run, web build,
  security scan, and browser verification for UI changes.

## Demo Strategy

The repeatable judge path uses three deterministic mock scenarios:
`allowed-payment`, `prompt-injection-attack`, and `replay-attack`. Each prints the
agent intent, normalized request, checks, decision, reason, settlement-call flag,
budget delta, and explicit mock label. A separate Testnet card continues to show
only the already verified proof-recorder transactions. After Milestone 3, a
credentialed live run can be shown as a fourth path with a freshly confirmed
payment transaction.

## Baseline Validation Record

Run on 2026-07-14 before implementation:

| Command | Result | Classification |
|---|---|---|
| `pnpm install` | pass | repository |
| `pnpm docs:check` | pass | repository |
| `pnpm typecheck` | TypeScript reported no errors, but `rtk` returned false status 1 | wrapper/environment; unfiltered command passes |
| `pnpm test` | pass, 146 tests | repository |
| `pnpm contract:test` | pass, 8 tests | repository |
| `pnpm proof:testnet:dry-run` | pass; no submission | repository; credentials intentionally unnecessary |
| `pnpm --filter @cspr-agentpay/web build` | pass | repository |
| `pnpm security:check` | pass | repository |
# Milestone 2 update

The first real guarded payment path is implemented as a narrow local Testnet workflow. Live execution remains intentionally blocked at the explicit authorization-hash confirmation gate. Proof-recorder anchoring is optional follow-up and never gates premium release after verified settlement.
