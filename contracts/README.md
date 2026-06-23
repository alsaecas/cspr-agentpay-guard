# Contracts

Odra/Rust smart contract workspace for CSPR AgentPay Guard.

## Current Status

- ✅ **`AgentPayProofRecorder` contract source complete.**
- ✅ **Compiles** with Odra 2.8.1 (nightly Rust, `cargo-odra` 0.1.7, `wasm32-unknown-unknown`).
- ⬜ **Not deployed to Casper Testnet** — pending credentials (`CASPER_TESTNET_SECRET_KEY_PATH`).
- ⬜ **Not production escrow or custody** — the proof recorder is an audit anchor, not payable escrow.
- ✅ **Mock HTTP 402 flow** remains the primary reliable demo path.

## AgentPayProofRecorder

The deployed contract (`contracts/agentpay-guard`) is an **on-chain proof anchor**. It records:

- `paymentId`
- `requestHash`
- `policyId`
- `merchantId`
- `status` (authorized, escrowed, fulfilled, settled)
- `receiptHash` (optional)
- Caller address + block time

See `contracts/agentpay-guard/README.md` for full entrypoint documentation, validation rules, and event schema.

## Build & Deploy

```bash
pnpm contract:check           # Verify tooling (Rust, cargo-odra, wasm target)
pnpm contract:test            # Run unit tests (cargo test --lib)
pnpm contract:build           # Build wasm (cargo odra build)
pnpm contract:deploy:testnet  # Deploy to Casper Testnet (requires credentials)
```

## Planned Future Modules

See `docs/casper-contract-boundary.md` for the detailed contract boundary specification.

| Module | Purpose | Priority |
|---|---|---|
| `AgentPolicyRegistry` | On-chain policy storage and lifecycle. | Future |
| `MerchantRegistry` | On-chain merchant identity and allowlist binding. | Future |
| `PaymentEscrow` | Payment lifecycle with replay protection, escrow, fulfillment, settlement. | Future |

## Honest Limitations

- **The `AgentPayProofRecorder` contract has not been deployed.**
- **No real Casper Testnet transaction has been submitted.**
- **No CSPR has been moved on Testnet.**
- **`pnpm proof:testnet:dry-run` works. `pnpm proof:testnet` exits gracefully with setup instructions.**
- **All mock-mode demo paths remain reliable and unchanged.**
