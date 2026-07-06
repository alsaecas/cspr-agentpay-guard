## Summary

- 

## Validation

- [ ] `pnpm docs:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm proof:testnet:dry-run`
- [ ] `pnpm --filter @cspr-agentpay/web build`
- [ ] `pnpm security:check`

## Safety

- [ ] No `.env`, PEM, wallet, private key, or secret files added
- [ ] No fake Casper hashes added
- [ ] Mock payment execution remains clearly labeled
- [ ] No production escrow/custody/real CSPR settlement claims added
