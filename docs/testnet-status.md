# Casper Testnet Integration Status

Last updated: 2026-06-23 (Prompt 10)

## Current State

**Mock mode is the primary reliable demo.** All payments use deterministic local `mock-*` proof hashes. No real Casper funds move.

**Real Casper Testnet proof is a skeleton.** The `RealCasperTestnetAdapter` validates env vars, builds dry-run payloads, and returns clear error messages. It does NOT submit real transactions yet because Odra contract deployment has not been completed.

## What Is Implemented

| Component | Status |
|---|---|
| Protocol types (`CasperProof`, `PaymentReceipt`, etc.) | ✅ Complete |
| `MockCasperPaymentAdapter` (full state machine) | ✅ Complete |
| `RealCasperTestnetAdapter` (interface compliance) | ✅ Complete |
| `RealCasperTestnetAdapter.getMissingEnvVars()` | ✅ Complete |
| `RealCasperTestnetAdapter.buildProofDryRun()` | ✅ Complete |
| `RealCasperTestnetAdapter.recordAgentPayProof()` | ✅ Skeleton |
| `pnpm proof:testnet:dry-run` | ✅ Works |
| `pnpm proof:testnet` | ✅ Graceful exit with missing setup |
| Dashboard Testnet proof card | ✅ Shows status |
| `CasperProof` schema (transaction-v1, legacy-deploy, mock) | ✅ Complete |

## What Is NOT Yet Implemented

| Component | Reason |
|---|---|
| Odra contract compilation | `cargo-odra` not installed (requires `cargo install cargo-odra --locked` + `wasm32-unknown-unknown` target) |
| Real Casper Testnet deploy submission | Contract hash unknown; no deployed contract |
| Real `casper-js-sdk` integration | Pending contract deployment |
| CSPR.cloud event reads | Pending Testnet event emission from a deployed contract |
| CSPR.click wallet integration | Not part of MVP core path |

## Chosen SDK / Package

| Integration | Version | Source |
|---|---|---|
| Casper JS/TS SDK | `5.0.12` (npm) | [npm](https://www.npmjs.com/package/casper-js-sdk) |
| TransactionV1 support | Yes (Casper 2.x) | [Casper docs](https://docs.casper.network/concepts/transactions) |
| Legacy Deploy support | Deprecated but available | Kept as `legacy-deploy` proof kind for backward compat |

## Required Environment Variables

```bash
# Real Casper Testnet proof
CASPER_NETWORK=casper-test
CASPER_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_TESTNET_PUBLIC_KEY=
CASPER_TESTNET_SECRET_KEY_PATH=
CASPER_AGENTPAY_CONTRACT_HASH=       # Populated after deployment
CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=  # Populated after deployment

# Optional: CSPR.cloud
CSPR_CLOUD_AUTH_TOKEN=
CSPR_CLOUD_API_URL=https://api.cspr.cloud
CSPR_CLOUD_STREAM_URL=wss://streaming.testnet.cspr.cloud
```

## Dry-Run vs Real Proof

```bash
# Always safe — no credentials needed
pnpm proof:testnet:dry-run

# Requires env vars + deployed contract
pnpm proof:testnet
```

## Proof Kinds

| Kind | When Used |
|---|---|
| `mock` | Mock mode — deterministic local hashes, `mock-*` prefixed |
| `transaction-v1` | Real mode — Casper 2.x TransactionV1 hash (preferred) |
| `legacy-deploy` | Real mode — Legacy deploy hash (deprecated, backward compat) |

## Contracts Status

See `contracts/README.md` and `contracts/agentpay-guard/README.md`.

- `contracts/agentpay-guard/src/lib.rs`: Minimal Odra scaffold (`init()`, `is_initialized()`)
- No production escrow, policy registry, or payment logic exists
- First real target: on-chain event/state proof (record paymentId, requestHash, status)
- Payable escrow is a stretch goal
- Mock HTTP 402 flow remains the main demo path

## Next Steps To Activate Real Testnet Proof

1. Install Rust + wasm target:
   ```bash
   rustup target add wasm32-unknown-unknown
   cargo install cargo-odra --locked
   ```

2. Build the proof recorder contract.

3. Deploy to Casper Testnet using `casper-client` or `casper-js-sdk`.

4. Set `CASPER_AGENTPAY_CONTRACT_HASH` in `.env`.

5. Run `pnpm proof:testnet` to submit a real proof anchor.

## Honest Limitations

- The `RealCasperTestnetAdapter` does NOT fake real chain success. Every method throws clear "not implemented yet" errors.
- `recordAgentPayProof` returns a dry-run proof. It does NOT submit to the chain.
- No CSPR.live links are shown unless a real transaction hash exists.
- No private keys or CSPR.cloud tokens are exposed to the frontend.
- The dashboard clearly labels all mock proofs.
