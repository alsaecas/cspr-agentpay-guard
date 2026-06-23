# AgentPay Guard — Proof Recorder Contract

Odra smart contract for anchoring AgentPay proofs on Casper Testnet.

## Current Status

- ✅ **Contract source complete.** `lib.rs` contains the full `AgentPayProofRecorder`.
- ✅ **Compiles** with Odra 2.8.1 (nightly Rust required).
- ⬜ **Not deployed to Casper Testnet** — pending credentials.
- ⬜ **Not production escrow or custody** — this is an audit anchor, not payable escrow.

## Entrypoints

| Entrypoint | Description |
|---|---|
| `init()` | Initialize the proof recorder. Must be called once after deployment. |
| `record_proof(payment_id, request_hash, policy_id, merchant_id, status, receipt_hash)` | Record an AgentPay proof. See validation rules below. |
| `get_proof(payment_id)` | Retrieve a stored proof by paymentId. Returns `None` if not found. |
| `proof_count()` | Return the total number of recorded proofs. |

## Accepted Statuses

- `authorized`
- `escrowed`
- `fulfilled`
- `settled`

## Validation Rules

- **Empty `paymentId`** → rejected.
- **Empty `requestHash`** → rejected.
- **Duplicate `paymentId`** → rejected.
- **Invalid status** (anything outside the 4 accepted values) → rejected.

## Events

The contract emits `AgentPayProofRecorded` with:
- `payment_id`, `request_hash`, `policy_id`, `merchant_id`, `status`, `receipt_hash` (optional), `actor` (caller address), `recorded_at` (block time).

## Build, Test, Deploy

```bash
# Check tooling
pnpm contract:check

# Build wasm
pnpm contract:build

# Run unit tests
pnpm contract:test

# Deploy to Casper Testnet (requires credentials)
pnpm contract:deploy:testnet
```

## Deployment Requirements

- Rust nightly (`rustup default nightly`)
- `cargo-odra` 0.1.7+ (`cargo install cargo-odra --locked`)
- `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- `CASPER_TESTNET_SECRET_KEY_PATH` in `.env`

## Disclaimer

**This contract is an audit anchor. It does NOT handle CSPR payments, escrow, or custody. Payable escrow is future work. All mock-mode demo paths remain unchanged and reliable.**
