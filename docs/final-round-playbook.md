# Final-Round Reviewer Playbook

## Links

- Repository: https://github.com/alsaecas/cspr-agentpay-guard
- Live dashboard: https://cspr-agentpay-guard.vercel.app
- Demo video: pending; replace this placeholder with the public video URL.
- Testnet status: `docs/testnet-status.md`

## Local Setup

```bash
pnpm install
pnpm docs:check
pnpm typecheck
pnpm test
pnpm proof:testnet:dry-run
pnpm --filter @cspr-agentpay/web build
pnpm security:check
```

Expected result: all commands exit with status `0`. The dry run prints the proof payload and does not submit a transaction.

## Terminal Demo

```bash
pnpm demo:mock
```

Expected result:

1. Agent receives `402 Payment Required`.
2. Policy authorizes the request under merchant, resource, amount, budget, and expiry checks.
3. Mock Casper adapter returns deterministic `mock-*` proof fields.
4. Agent retries with `X-AgentPay-Receipt`.
5. Premium parking report is returned.
6. Mock payment is fulfilled and settled in local audit state.

## Dashboard Demo

Production:

```text
https://cspr-agentpay-guard.vercel.app/demo
```

Local:

```bash
pnpm --filter @cspr-agentpay/web dev
open http://localhost:3000/demo
```

Expected result:

1. Click `Run AgentPay Demo`.
2. Timeline shows the HTTP 402 flow, policy authorization, receipt retry, fulfillment, settlement, and audit update.
3. Payment receipt uses mock proof values and is visibly labeled mock mode.
4. Testnet Proof card links to the real Casper Testnet deployment and proof transactions.
5. `/audit` and `/payments` show the generated audit/payment events after the run.

## Casper Testnet Proof Verification

Contract hash:

```text
2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01
```

Package hash:

```text
d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010
```

Deployment transaction:

- Hash: `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- Link: https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c
- Description: deploys the Odra `AgentPayProofRecorder` contract to Casper Testnet.

Proof transaction:

- Hash: `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`
- Link: https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409
- Description: calls `record_proof` with AgentPay proof fields for one payment proof record.

## BUIDL Page Values

Use these values on the DoraHacks BUIDL page:

- Contract package hash: `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010`
- Contract hash: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- Sample Testnet transaction 1: contract deployment, `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- Sample Testnet transaction 2: proof recording call, `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`

## What Is Real vs Mock

Real:

- Protocol types, canonical hashes, and validation schemas.
- Policy checks for merchant allowlist, resource scope, amount limit, total budget, expiry, and request hash.
- HTTP 402 paid-resource flow and request-bound receipt verification.
- Casper Testnet `AgentPayProofRecorder` contract deployment.
- Casper Testnet `record_proof` transaction listed above.

Mock:

- Payment execution and settlement state machine.
- Interactive dashboard payment proofs shown as `mock-*` values.

Not claimed:

- Production escrow.
- Custody of funds.
- Real CSPR payment settlement.

## Known Limitations

- CSPR.cloud indexing is not implemented.
- CSPR.click is not implemented.
- The Casper contract is a proof recorder, not payable escrow.
- Real Testnet deploy/proof commands require a funded Testnet key and local `.env`; CI only runs `proof:testnet:dry-run`.
- Demo video URL is pending until the final public video is uploaded.
