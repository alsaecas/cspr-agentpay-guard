# Contracts

Odra/Rust smart contract workspace for CSPR AgentPay Guard.

## Current Status

- **Scaffold only.** No production escrow, policy, or settlement logic exists yet.
- The `agentpay-guard` crate contains a minimal Odra module with `init()` and `is_initialized()` stubs.
- No real Casper Testnet deployment has been performed.
- `cargo-odra` is not installed locally (`cargo install cargo-odra --locked` required).
- `wasm32-unknown-unknown` target is not installed (`rustup target add wasm32-unknown-unknown` required).

## Implementation Priorities

1. **First real target: on-chain event/state proof.** Record `paymentId`, `requestHash`, and payment status on-chain. Emit CES events that CSPR.cloud can index. This gives judges a visible Casper Testnet transaction path.
2. **Payable escrow is a stretch goal.** Do not block the initial demo on actual CSPR custody. The mock HTTP 402 flow remains the main demo path until Testnet proof is added.
3. **Mock mode remains the primary demo path.** The TypeScript `MockCasperPaymentAdapter` implements the identical interface with deterministic proofs. It is bulletproof for local demos.

## Planned Contract Modules

See [docs/casper-contract-boundary.md](../docs/casper-contract-boundary.md) for the detailed contract boundary specification.

| Module | Purpose | Priority |
|---|---|---|
| `AgentPolicyRegistry` | On-chain policy storage and lifecycle. | High |
| `MerchantRegistry` | On-chain merchant identity and allowlist binding. | High |
| `PaymentEscrow` | Payment lifecycle with replay protection, escrow, fulfillment, and settlement. | High |

## Proof Recorder (Prompt 10)

The minimal first contract is an **AgentPay proof recorder** (or proof anchor). It records:

- `paymentId`
- `requestHash`
- `policyId`
- `merchantId`
- `status` (authorized, escrowed, fulfilled, settled)
- `receiptHash`
- Block timestamp

This is NOT a production escrow contract. It is an audit anchor — a Casper Testnet record that a specific AgentPay payment event happened under a specific policy.

## Build & Deploy (when tools are installed)

```bash
# Build
cd contracts/agentpay-guard
cargo odra build

# Test
cargo odra test

# Deploy to Casper Testnet
cargo odra deploy \
  --backend casper \
  --env casper-test \
  --secret-key $ODRA_CASPER_LIVENET_SECRET_KEY_PATH
```

## Environment

Copy `contracts/.env.example` to `contracts/.env` and fill in your Testnet keys before attempting real deployment.

Required tools:

- Rust `1.84+` with `wasm32-unknown-unknown` target
- `cargo-odra` (`cargo install cargo-odra --locked`)
- `casper-client` (updated to `5.0.1+`)

## Honest Limitations

See `docs/testnet-status.md` for the current real Testnet proof status.

- **No contract has been compiled or deployed.**
- **No CSPR has been moved on Testnet.**
- **The `RealCasperTestnetAdapter.recordAgentPayProof` is a skeleton that validates payloads but does not submit transactions.**
- **`pnpm proof:testnet:dry-run` works. `pnpm proof:testnet` exits gracefully with setup instructions.**
- **All mock-mode demo paths remain reliable and unchanged.**
