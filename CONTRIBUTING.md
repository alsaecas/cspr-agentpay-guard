# Contributing

Thanks for helping improve CSPR AgentPay Guard.

## Local Setup

```bash
pnpm install
pnpm docs:check
pnpm typecheck
pnpm test
pnpm proof:testnet:dry-run
pnpm --filter @cspr-agentpay/web build
```

## Pull Requests

- Keep changes scoped to the AgentPay Guard thesis: HTTP 402 agent payments, request-bound receipts, policy checks, Casper proof recording, and audit visibility.
- Do not commit `.env`, PEM files, wallet files, private keys, or credentials.
- Do not fake Casper hashes or claim mock payments are real CSPR settlement.
- Update docs when protocol objects, hashes, deployment status, or reviewer instructions change.
- Include tests proportional to the risk of the change.

## Real vs Mock Boundary

Hosted scenarios use deterministic no-spend execution. One separate guarded native-CSPR payment and one separate Odra proof transaction are publicly verified on Casper Testnet. This project does not implement production escrow, custody, Mainnet, or an audited settlement service.
