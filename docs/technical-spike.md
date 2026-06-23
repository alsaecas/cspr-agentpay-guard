# Technical Spike: Casper Integration

Investigation date: 2026-06-03
Last updated: 2026-06-23 (Prompt 13B)

Scope: identify the current best package choices and integration strategy for the Casper path. This is not an implementation plan for production custody. The project remains mock-first and real-Casper-second as defined in `AGENTS.md`.

## Current Status — All 13 Prompts Complete

1. ✅ Prompt 1–4: protocol types, deterministic hashes, pure policy checks, audit event types, mock state machine.
2. ✅ Prompt 5: Casper contract boundary documentation, adapter skeleton.
3. ✅ Prompt 6 + 6B: paid-api HTTP 402 flow + request-bound receipt repair.
4. ✅ Prompt 7: MCP server (6 tools).
5. ✅ Prompt 8: agent demo (self-contained terminal).
6. ✅ Prompt 9: dashboard (6 pages, Next.js, dark theme).
7. ✅ Prompt 10: proof dry-run + dashboard Testnet card.
8. ✅ Prompt 11: `AgentPayProofRecorder` Odra contract (source, compiles).
9. ✅ Prompt 12: contract build/deploy scripts + submission docs.
10. ✅ Prompt 13: final documentation polish.
11. ⬜ Optional: real Casper Testnet contract deployment (credentials pending).
9. Use CSPR.cloud as the read/index/streaming layer for dashboard proof.
10. Use CSPR.click for policy owner wallet UX and optional funding/signing, not as the core autonomous-agent payment mechanism.
11. Add MCP as an agent-facing tool surface only after the HTTP 402 flow works.

## Chosen Libraries

| Integration | Choice | Version checked | Link | Why |
| --- | --- | --- | --- | --- |
| Odra smart contracts | `cargo-odra`, `odra`, `odra-build`, `odra-casper-livenet-env` | `cargo-odra 0.1.7`, Odra crates `2.7.2` from crates.io | [Odra docs](https://odra.dev/docs/), [odra crate](https://crates.io/crates/odra), [odra-casper-livenet-env](https://crates.io/crates/odra-casper-livenet-env) | Odra is the Casper-native Rust smart contract framework, supports Casper backend builds, Livenet deployment, payable patterns, and CES-style events. |
| Casper Testnet deploys / transactions | `casper-client` CLI plus `casper-js-sdk` for backend transaction submission | `casper-client 5.0.1` available on crates.io; local machine currently has `Casper client 2.0.0` | [Casper transactions docs](https://docs.casper.network/concepts/transactions), [Odra Casper backend](https://odra.dev/docs/backends/casper/) | CLI is the safest fallback for contract deployment. SDK is better for app-controlled Testnet payment/receipt flows. |
| Casper JS/TS SDK | `casper-js-sdk` | `5.0.12` npm latest; `5.0.16-beta2` condor tag exists | [npm](https://www.npmjs.com/package/casper-js-sdk), [SDK docs](https://casper-ecosystem.github.io/casper-js-sdk/), [Casper SDK docs](https://docs.casper.network/sdk) | Official ecosystem package for keys, signing, RPC, TransactionV1, transfers, contract calls, and event streaming. Use stable latest, not beta. |
| CSPR.click | `@make-software/csprclick-ui`, `@make-software/csprclick-core-types`, `styled-components`; avoid `@make-software/csprclick-core-client` unless required by compile-time examples | UI `2.0.5`, core types `2.0.3`, styled-components `6.4.2`; core client `1.11.0` | [CSPR.click React docs](https://docs.cspr.click/cspr.click-sdk/react), [CSPR.click changelog](https://docs.cspr.click/documentation/changelog), [npm UI](https://www.npmjs.com/package/@make-software/csprclick-ui) | Best fit for wallet connection, user approval, and demo funding. Changelog says types moved to core-types, so treat core-client as deprecated/conditional. |
| CSPR.cloud REST/index reads | Native `fetch` for REST, `ws` for backend WebSocket streams, CSPR.click proxy only for frontend experiments | `ws 8.21.0` | [CSPR.cloud docs](https://docs.cspr.cloud/), [CSPR.cloud getting started](https://docs.cspr.cloud/documentation/getting-started), [contract events stream](https://docs.cspr.cloud/streaming-api/contract-level-events) | CSPR.cloud provides indexed REST, Testnet node RPC, WebSocket streaming, contract-level events, and authorization headers. No dedicated npm client is needed for MVP. |
| MCP server in TypeScript | `@modelcontextprotocol/sdk`, `zod`, `tsx`, `typescript` | MCP SDK `1.29.0`, zod `4.4.3`, tsx `4.22.4`, TypeScript `6.0.3` | [MCP SDK docs](https://modelcontextprotocol.io/docs/sdk), [TypeScript SDK docs](https://ts.sdk.modelcontextprotocol.io/), [npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) | Official Tier 1 TypeScript SDK. Use stdio for local agent demos first; Streamable HTTP for hosted/remote tools later. |

## Casper 2.x Terminology Risk

Casper 2.0 docs say Transactions supersede legacy Deploys and legacy Deploy support is deprecated. The protocol now uses `PaymentReceipt.proof` internally and keeps `casperDeployHash` only as an optional display compatibility field.

Recommendation:

- `PaymentReceipt.proof` is now the internal source of truth.
- Keep `PaymentReceipt.casperDeployHash` and `casperEventId` only as backward-compatible display fields when useful for current UI copy.
- Proof is modeled as:

```ts
type CasperProof =
  | { kind: "mock"; hash: string; eventId: string }
  | { kind: "transaction-v1"; transactionHash: string; eventId?: string }
  | { kind: "legacy-deploy"; deployHash: string; eventId?: string };
```

- Real integration should populate `proof.kind = "transaction-v1"` for Casper 2.x transactions or `proof.kind = "legacy-deploy"` only for legacy paths.

## Mock Fallbacks

Every integration must have a local fallback with the same app-facing interface.

| Integration | Mock fallback |
| --- | --- |
| Odra contract | `MockPaymentContractStore` in TypeScript, keyed by `paymentId`, enforcing state transitions and duplicate-settlement rejection. |
| Casper Testnet deploy/transaction | `MockCasperPaymentAdapter` returns deterministic `mock-*` proof hashes and event IDs derived from `paymentId`. |
| Casper JS/TS SDK | Adapter test double with no network calls and fixed transaction status progression: `authorized -> submitted -> escrowed -> fulfilled -> settled`. |
| CSPR.click | `MockWalletAdapter` with a seeded demo public key and explicit UI label `mock wallet`. No per-payment human approval. |
| CSPR.cloud | `MockCasperEventIndex` exposes REST-like reads and WebSocket-like event callbacks over the local audit log. |
| MCP server | MCP tools call the same mock gateway and policy engine. If MCP is not running, the demo agent can call the HTTP API directly. |

Mock mode must remain visibly labeled and must never be presented as real Casper settlement.

## What Will Be Mocked First

Mock first:

- Policy creation and budget state through `packages/policy`.
- Merchant registry and allowlist checks.
- HTTP `402 Payment Required` response.
- `PaymentRequirement`, `PaymentAuthorization`, `PaymentReceipt`.
- `requestHash` and `paymentId` deterministic fixtures.
- Casper payment submission, event emission, receipt status transitions, fulfillment, settlement, duplicate settlement rejection, and nonce replay rejection.
- CSPR.cloud event reads and stream updates.
- CSPR.click wallet connection in the dashboard.
- MCP tools for calling the same demo flow.

The mock adapter should be good enough for the 3-minute demo even when Testnet, CSPR.cloud, wallet popups, or contract deployment are unavailable.

## What Will Be Real On Casper Testnet

Minimum real Testnet path:

1. Submit a real Casper Testnet transaction or contract call through `casper-js-sdk` or `casper-client`.
2. Display the returned transaction/deploy hash in the dashboard.
3. Read confirmation through Casper RPC or CSPR.cloud.
4. Show a CSPR.live/Testnet link.

Preferred real Testnet path:

1. Deploy an Odra `AgentPayLedger` or `AgentPayEscrow` contract.
2. Call `authorize_or_escrow_payment(paymentId, requestHash, merchant, amount, expiresAt)`.
3. Store payment status on-chain.
4. Emit CES events such as `PaymentEscrowed`, `PaymentFulfilled`, and `PaymentSettled`.
5. Use CSPR.cloud contract-level event streaming to update the dashboard.
6. Reject duplicate settlement on-chain by checking stored `paymentId` status.

Stretch real Testnet path:

- Attach actual CSPR to a payable Odra escrow entrypoint.
- Use Odra's payable/cargo purse or proxy caller path.
- Allow merchant settlement to transfer escrowed funds.

This stretch path has higher risk and should not block the initial visible Casper proof.

## Recommended Repo Structure

```text
apps/
  agent/                  # Demo autonomous agent runner
  gateway/                # HTTP 402 payment firewall
  merchant-api/           # Protected demo API
  dashboard/              # Judge-facing audit UI
  mcp-server/             # Optional MCP tool surface

packages/
  protocol/               # AgentPolicy, Merchant, PaymentRequirement, hashes
  policy/                 # Pure policy checks and budget logic
  audit/                  # Audit event types and local event store
  casper-adapter/         # Adapter interface and shared receipt mapping
    mock/                 # Deterministic mock Casper adapter
    testnet/              # Real Casper Testnet adapter
  cspr-cloud/             # CSPR.cloud REST/stream read adapter
  cspr-click/             # Wallet UI/session adapter for dashboard only

contracts/
  agentpay-guard/         # Odra contract crate
    src/
    bin/                  # Livenet deploy/call scripts
    tests/

scripts/
  demo/
  casper/
  fixtures/

docs/
```

Keep the Casper adapter narrow. The gateway and policy engine should never import CSPR.click, CSPR.cloud, Odra, or raw SDK classes directly.

## Local Environment Variables

Use `.env` locally and commit only `.env.example`.

```bash
# App mode
AGENTPAY_MODE=mock # mock | casper-testnet
AGENTPAY_DEMO_SEED=agentpay-demo

# Casper network
CASPER_NETWORK=casper-test
CASPER_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_NODE_SSE_URL=https://node-sse.testnet.cspr.cloud/events/main
CASPER_PAYMENT_GAS_MOTES=100000000
CASPER_PAYMENT_AMOUNT_MOTES=1000000000

# Testnet account used by backend real adapter.
# Never commit these files or values.
CASPER_TESTNET_PUBLIC_KEY=
CASPER_TESTNET_SECRET_KEY_PATH=
CASPER_MERCHANT_PUBLIC_KEY=
CASPER_MERCHANT_ACCOUNT_HASH=

# Odra livenet
ODRA_CASPER_LIVENET_ENV=casper-test
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.cspr.cloud
ODRA_CASPER_LIVENET_EVENTS_URL=https://node-sse.testnet.cspr.cloud/events/main
ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test
ODRA_CASPER_LIVENET_TTL=

# CSPR.cloud
CSPR_CLOUD_AUTH_TOKEN=
CSPR_CLOUD_API_URL=https://api.cspr.cloud
CSPR_CLOUD_STREAM_URL=wss://streaming.testnet.cspr.cloud
CSPR_CLOUD_CONTRACT_EVENTS_PATH=/contract-events

# Real contract once deployed
CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=
CASPER_AGENTPAY_CONTRACT_HASH=

# CSPR.click dashboard integration
CSPR_CLICK_APP_ID=csprclick-template
CSPR_CLICK_APP_NAME=CSPR AgentPay Guard
CSPR_CLICK_PROVIDERS=casper-wallet,ledger,metamask-snap,casperdash

# MCP
MCP_TRANSPORT=stdio # stdio | streamable-http
MCP_HTTP_PORT=8787
```

Local tools observed:

- Node `v26.0.0`
- npm `11.12.1`
- rustc `1.84.1`
- cargo `1.84.1`
- `cargo odra` not installed
- local `casper-client` reports `2.0.0`, while crates.io has `casper-client 5.0.1`

Setup implication: install `cargo-odra`, add `wasm32-unknown-unknown`, and update `casper-client` before real contract work.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Odra docs show `2.6.0`, while crates.io has `2.7.2` | Generated templates or examples may not match latest crates | Pin versions after `cargo odra new`; if latest fails, pin to docs version and record it. |
| `cargo odra` not installed locally | Cannot build or test contracts yet | Install `cargo-odra --locked` during contract setup, not during this docs spike. |
| Local `casper-client` version is old | CLI examples may fail or use deprecated commands | Update to `casper-client 5.0.1` or use `casper-js-sdk` for app transactions. |
| Casper 2.x deploy vs transaction terminology | Receipt schema may mislabel real proofs | Add an internal `CasperProof` union and update protocol docs before implementation if renaming fields. |
| Odra payable escrow may require proxy/cargo purse handling | Actual CSPR escrow can consume deadline time | Make on-chain event/state proof the first real target; keep true payable escrow as stretch. |
| CSPR.click docs and changelog disagree on `core-client` | Frontend install may be noisy or outdated | Start with UI plus core-types. Add core-client only if current code requires it. |
| CSPR.click is human-wallet UX | It cannot be the autonomous agent's per-payment path | Use it for owner setup/funding; backend policy/adapter handles autonomous payment. |
| CSPR.cloud requires access token | Event reads fail without account setup | Keep mock event index; add clear env validation and mode label. |
| CSPR.cloud streaming can duplicate messages or reconnect | Dashboard may show duplicate events | Deduplicate by `paymentId`, transaction hash, and event ID. |
| CSPR.cloud indexing latency | Dashboard may lag after transaction | Poll RPC first, then stream/index when available. Show `submitted` or `escrowed` state. |
| MCP remote server auth/CORS | Remote MCP demo can become infrastructure-heavy | Use stdio first for local demo. Streamable HTTP only after core flow works. |
| Testnet faucet or gas limits | Real demo can stall | Keep mock mode reliable and pre-fund testnet accounts before judging. |
| Secret key handling | Demo custody risk | Keep testnet-only keys in `.env`, never commit PEM files, never expose backend signing key to frontend. |

## Unknowns To Resolve Before Real Mode

- Whether Odra `2.7.2` and `cargo-odra 0.1.7` are fully compatible for a fresh Casper backend project.
- Exact CSPR.cloud event shape for custom Odra CES events emitted by this contract on Testnet.
- Whether CSPR.cloud Testnet streaming can be used reliably with the available access tier during the hackathon.
- Whether `ODRA_CASPER_LIVENET_EVENTS_URL` should use `https://node.testnet.cspr.cloud/events`, `https://node-sse.testnet.cspr.cloud/events/main`, or another CSPR.cloud-specific URL for Odra Livenet.
- Whether CSPR.click `send()` supports the exact TransactionV1 or contract-call JSON shape needed by the dashboard funding flow across selected wallets.
- Whether true on-chain escrow is feasible inside the hackathon timeline or should remain a stretch after on-chain payment-state proof.

## Odra Version Note

The Cargo.toml originally specified `odra = "2.7.2"` but Cargo resolved to `2.8.1` (semver-compatible). The `AgentPayProofRecorder` contract compiles against Odra 2.8.1 with nightly Rust. The Cargo.toml has been updated to `2.8.1` to match the resolved version.

## Optional Next Steps

1. Deploy `AgentPayProofRecorder` to Casper Testnet (`pnpm contract:deploy:testnet`).
2. Submit a real proof transaction (`pnpm proof:testnet`).
3. Add CSPR.cloud event reads for indexed proof events.
4. Add CSPR.click wallet integration for policy owner funding.
5. Production-grade escrow and settlement.
6. Multi-merchant demo.
