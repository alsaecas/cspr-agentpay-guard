# Contracts

Odra/Rust smart contract workspace for CSPR AgentPay Guard.

Current status:

- Scaffold only.
- No production escrow or settlement logic yet.
- Real Casper Testnet work should start after the TypeScript mock flow is stable.

Planned first contract:

- `AgentPayGuard`
- Store payment IDs and request hashes.
- Enforce single settlement per `paymentId`.
- Emit Casper Event Standard events for escrow and settlement.

