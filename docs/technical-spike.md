# Technical Spike: Casper Integration

Investigation date: 2026-06-03
Last updated: 2026-07-04

Scope: identify the current best package choices and integration strategy for the Casper path. This is not an implementation plan for production custody. The project remains mock-first and real-Casper-second as defined in `AGENTS.md`.

## Current Status

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
11. ✅ Contract manifest, wasm build, and schema generation repaired.
12. ✅ Guarded `casper-client` deploy/proof scripts added.
13. ⬜ Real Casper Testnet contract deployment (credentials and Testnet gas pending).

## Odra Version Note

The contract uses Odra `2.8.1` with `cargo-odra 0.1.7`. `odra-build` resolved to `2.8.2`, which is compatible for the generated build/schema helpers. The current `pnpm contract:build` command produces `wasm/AgentPayProofRecorder.wasm`.

## Chosen Libraries

| Integration | Choice | Version checked | Link | Why |
| --- | --- | --- | --- | --- |
| Odra smart contracts | `cargo-odra`, `odra`, `odra-build` | `cargo-odra 0.1.7`, Odra `2.8.1` | [Odra docs](https://odra.dev/docs/) | Odra is the Casper-native Rust smart contract framework. The proof-recorder contract builds to wasm.
| Casper Testnet deploys / transactions | `casper-client` CLI; future `casper-js-sdk` | local `Casper client 2.0.0` | [Casper transactions docs](https://docs.casper.network/concepts/transactions), [Odra Casper backend](https://odra.dev/docs/backends/casper/) | The current ready path uses legacy deploys: deploy wasm, then call `record_proof` by contract hash. SDK/TransactionV1 can replace this later.
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
CASPER_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_NODE_SSE_URL=
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
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.casper.network/rpc
ODRA_CASPER_LIVENET_EVENTS_URL=
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
- rustc `1.96.0` (nightly; `1.84.1` stable was original)
- cargo `1.84.1`
- `cargo-odra 0.1.7` installed
- `wasm32-unknown-unknown` target installed
- `wasm-opt` version 130 installed
- `wasm-strip` version 1.0.41 installed
- local `casper-client` reports `2.0.0`
- Contract builds with Odra 2.8.1 and generated Odra manifest/helpers
- Contract schema generated under `resources/casper_contract_schemas/`

Setup implication: nightly Rust, `cargo-odra`, the wasm target, Binaryen, WABT, and `casper-client` are available locally. Real deployment still needs a funded Testnet secret key.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Odra build metadata missing | `cargo odra build` does not recognize the crate | Added `Odra.toml`, build helpers, schema helpers, and contract-local wasm linker config. |
| `cargo-odra` missing | Cannot build contracts | Installed `cargo-odra 0.1.7`. |
| Binaryen/WABT missing | `cargo odra build` fails after wasm generation | `contract:check` now verifies `wasm-opt` and `wasm-strip`; install with `brew install binaryen wabt`. |
| Local `casper-client` is legacy | Proof path emits legacy deploy hashes, not TransactionV1 hashes | Proof schema supports `legacy-deploy`; docs label it honestly. |
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

- ✅ Odra 2.8.1 + `cargo-odra 0.1.7` confirmed compatible. `pnpm contract:build` passes.
- ✅ Legacy `casper-client put-deploy` proof path implemented for deployed contract hashes.
- ⬜ Real Testnet deploy hash and contract hash — pending funded key.
- ⬜ Exact CSPR.cloud event shape for custom Odra CES events — pending deployed contract.
- ⬜ Whether CSPR.cloud Testnet streaming works with available access tier — pending deployment.
- ⬜ ODRA_CASPER_LIVENET_EVENTS_URL exact value — pending deployment testing.
- ⬜ CSPR.click `send()` for TransactionV1 — pending wallet integration.
- ⬜ True on-chain escrow feasibility — stretch goal; proof recorder is audit anchor only.

## Optional Next Steps

1. Deploy `AgentPayProofRecorder` to Casper Testnet (`pnpm contract:deploy:testnet`).
2. Submit a real proof transaction (`pnpm proof:testnet`).
3. Add CSPR.cloud event reads for indexed proof events.
4. Add CSPR.click wallet integration for policy owner funding.
5. Production-grade escrow and settlement.
6. Multi-merchant demo.
