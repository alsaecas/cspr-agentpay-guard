# AgentPay Guard Contract

Odra contract placeholder for the future Casper Testnet proof path.

## Current Status

- **Scaffold only.** `lib.rs` contains a minimal module with `init()` and `is_initialized()`.
- No production escrow, policy registration, or payment logic yet.
- The first real target is on-chain event/state proof — recording `paymentId`, `requestHash`, and status — not production custody.
- Payable escrow is a stretch goal.
- The mock HTTP 402 flow remains the main demo path until Testnet proof is added.

## First Real Implementation

The first real implementation should stay narrow:

1. Record `paymentId` and `requestHash` on-chain.
2. Record payment status transitions.
3. Reject duplicate settlement by checking stored `paymentId` status.
4. Emit Casper Event Standard (CES) events that CSPR.cloud can index.
5. Map adapter methods to contract entrypoints as defined in `docs/casper-contract-boundary.md`.

## Planned Entrypoints

See the full contract boundary document (`docs/casper-contract-boundary.md`) for detailed input/output specs.

**AgentPolicyRegistry:**

- `create_policy(policy)` — store a new agent policy
- `revoke_policy(policy_id)` — revoke a policy
- `get_policy(policy_id)` — read a stored policy

**MerchantRegistry:**

- `register_merchant(merchant)` — register a merchant
- `get_merchant(merchant_id)` — read a stored merchant

**PaymentEscrow:**

- `authorize_payment(input)` — validate policy/merchant/budget, create authorization
- `submit_payment(payment_id)` — transition to escrowed
- `mark_fulfilled(payment_id)` — record fulfillment
- `settle_payment(payment_id)` — finalize settlement
- `expire_payment(payment_id)` — expire a non-terminal payment
- `get_payment(payment_id)` — read a stored payment

## Building

```bash
cargo odra build
```

## Testing

```bash
cargo odra test
```

## Deploying to Casper Testnet

This is a scaffold — deployment instructions will be added when a real contract exists.
