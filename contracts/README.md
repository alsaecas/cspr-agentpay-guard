# Contracts

Odra/Rust smart contract workspace for CSPR AgentPay Guard.

## Current Status

- **Scaffold only.** No production escrow, policy, or settlement logic exists yet.
- The `agentpay-guard` crate contains a minimal Odra module with `init()` and `is_initialized()` stubs.
- No real Casper Testnet deployment has been performed.

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

## Environment

Copy `contracts/.env.example` to `contracts/.env` and fill in your Testnet keys before attempting real deployment.

Required tools:

- Rust `1.84+` with `wasm32-unknown-unknown` target
- `cargo-odra` (`cargo install cargo-odra --locked`)
- `casper-client` (updated to `5.0.1+`)

## Stretch Goals (after on-chain proof works)

- Attach actual CSPR to a payable Odra escrow entrypoint.
- Settlement transfers escrowed funds to merchant.
- Multi-merchant registry with reputation or staking.
- Rolling time-window budgets enforced on-chain.
