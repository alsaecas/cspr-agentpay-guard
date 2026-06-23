# Casper Testnet Integration Status

Last updated: 2026-06-23 (Prompt 11 — Final)

## Current State

**Mock mode is the primary reliable demo.** All payments use deterministic local `mock-*` proof hashes.

**Real Casper Testnet proof is implemented as a skeleton with a real contract.** The `AgentPayProofRecorder` Odra contract compiles against Odra 2.8.1 and is ready for deployment. The TypeScript adapter validates payloads and reports missing setup clearly.

## Final Decision

| Question | Answer |
|---|---|
| Real contract source? | ✅ Yes — `contracts/agentpay-guard/src/lib.rs` |
| Contract compiled? | ✅ Yes — compiles with `cargo build` (nightly Rust + Odra 2.8.1) |
| Contract deployed to Testnet? | ⬜ Pending — requires `cargo odra build` + `cargo odra deploy` with Testnet credentials |
| Real proof transaction submitted? | ⬜ Pending — `pnpm proof:testnet:dry-run` works; real submission needs deployed contract hash |
| Transaction/deploy hash? | Pending deployment |
| CSPR.live link? | Pending deployment |

## Known Blockers

1. **Contract deployment credentials** — `CASPER_TESTNET_PUBLIC_KEY`, `CASPER_TESTNET_SECRET_KEY_PATH`, and testnet CSPR for gas.
2. **`cargo odra build`** — Requires `cargo-odra 0.1.7` + `wasm32-unknown-unknown` (both installed locally).
3. **`cargo odra deploy`** — Deploys the wasm to Casper Testnet, returns contract hash.
4. **Set contract hash in `.env`** — `CASPER_AGENTPAY_CONTRACT_HASH=<hash>` after deployment.
5. **Run `pnpm proof:testnet`** — Records a real AgentPay proof on-chain.

## What Is Implemented

| Component | Status |
|---|---|
| `AgentPayProofRecorder` contract (Odra) | ✅ Written, compiles |
| `record_proof`, `get_proof`, `proof_count` entrypoints | ✅ Implemented |
| Duplicate paymentId rejection | ✅ |
| Invalid status rejection | ✅ |
| Empty paymentId/requestHash rejection | ✅ |
| `AgentPayProofRecorded` CES event | ✅ Implemented |
| 8 contract unit tests (compile) | 📝 Need Odra test env tuning |
| `RealCasperTestnetAdapter.getMissingChainEnvVars()` | ✅ |
| `RealCasperTestnetAdapter.getMissingCsprCloudEnvVars()` | ✅ |
| `RealCasperTestnetAdapter.buildProofDryRun()` | ✅ |
| `RealCasperTestnetAdapter.recordAgentPayProof()` | ✅ Skeleton |
| `pnpm proof:testnet:dry-run` | ✅ Works |
| `pnpm proof:testnet` | ✅ Graceful exit with setup instructions |
| Dashboard Testnet proof card | ✅ |
| `CasperProof` schema (transaction-v1, legacy-deploy) | ✅ |

## How To Deploy (when credentials are ready)

```bash
# 1. Build the contract wasm
cd contracts/agentpay-guard
cargo odra build

# 2. Deploy to Casper Testnet
cargo odra deploy \
  --backend casper \
  --env casper-test \
  --secret-key $CASPER_TESTNET_SECRET_KEY_PATH

# 3. Set the contract hash in .env
# CASPER_AGENTPAY_CONTRACT_HASH=<deployed-hash>

# 4. Record a proof
pnpm proof:testnet
```

## Required Env Vars for Chain Submission

```bash
CASPER_NETWORK=casper-test
CASPER_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_TESTNET_PUBLIC_KEY=
CASPER_TESTNET_SECRET_KEY_PATH=
CASPER_AGENTPAY_CONTRACT_HASH=
```

CSPR.cloud vars are OPTIONAL (for event reads only):
```bash
CSPR_CLOUD_AUTH_TOKEN=
CSPR_CLOUD_API_URL=https://api.cspr.cloud
CSPR_CLOUD_STREAM_URL=wss://streaming.testnet.cspr.cloud
```

## Proof Kinds

| Kind | When Used |
|---|---|
| `mock` | Mock mode — deterministic local hashes, `mock-*` prefixed |
| `transaction-v1` | Real mode — Casper 2.x TransactionV1 hash (preferred) |
| `legacy-deploy` | Real mode — Legacy deploy hash (deprecated) |

## Honest Limitations

- No real Casper Testnet transaction has been submitted yet (requires deployed contract + credentials).
- Contract compiles but unit tests need Odra test environment tuning.
- No CSPR.live links shown unless a real transaction hash exists.
- No private keys or CSPR.cloud tokens exposed to frontend.
- Dashboard clearly labels all mock proofs.
