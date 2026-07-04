# Final Checklist — CSPR AgentPay Guard

Last updated: 2026-07-04

## GitHub / Submission

- [ ] GitHub repo public: `https://github.com/alsaecas/cspr-agentpay-guard`
- [x] README complete
- [x] DoraHacks paste-ready submission doc complete: `docs/submission.md`
- [x] Testnet status doc complete: `docs/testnet-status.md`
- [x] Video script complete: `docs/video-script.md`
- [x] No production escrow/custody disclaimer present
- [x] What is real vs mock documented
- [ ] Demo video recorded and uploaded
- [ ] DoraHacks form submitted

## Local Prototype

```bash
pnpm install                         # pass
pnpm docs:check                      # pass
pnpm typecheck                       # pass with raw pnpm; rtk wrapper returned a false nonzero
pnpm test                            # pass, 146 tests
pnpm demo:mock                       # pass
pnpm --filter @cspr-agentpay/web build  # pass
```

## Dashboard

- [x] Dashboard command documented
- [x] Paid API command documented
- [x] Mock mode visibly labeled
- [x] Testnet proof status card present
- [ ] Optional hosted dashboard URL: pending / optional

Dashboard commands:

```bash
pnpm --filter @cspr-agentpay/paid-api dev
pnpm --filter @cspr-agentpay/web dev
```

## Casper Testnet

```bash
pnpm proof:testnet:dry-run      # pass
pnpm contract:check             # pass
pnpm contract:build             # pass
pnpm contract:test              # pass, 8 tests
pnpm contract:deploy:testnet    # ready; fails safely without credentials
pnpm proof:testnet              # ready; requires credentials + contract hash
```

Status:

- [x] Contract source exists
- [x] Odra manifest exists
- [x] Contract schema generated
- [x] Contract wasm generated
- [x] Dry-run proof works without credentials
- [x] Deploy script fails safely when credentials are missing
- [x] Proof script fails safely when credentials or contract hash are missing
- [ ] Contract deployed to Casper Testnet: pending funded Testnet key
- [ ] Contract hash documented: pending
- [ ] Deployment transaction link documented: pending
- [ ] Proof transaction submitted: pending deployed contract hash
- [ ] Proof transaction link documented: pending

## Real vs Mock Safety

- [x] `.env` ignored
- [x] `*.pem` ignored
- [x] No private keys documented
- [x] No fake deploy hash documented
- [x] No `mock-*` hash presented as a Casper transaction
- [x] Mock mode described as deterministic local simulation
- [x] Casper contract described as audit/proof anchor, not payable escrow

## DoraHacks Fields Prepared

- Project title: CSPR AgentPay Guard
- One-liner: Policy-controlled HTTP 402 payments for autonomous AI agents with Casper proof anchoring.
- Repository: `https://github.com/alsaecas/cspr-agentpay-guard`
- Video: pending
- Live demo: pending / optional hosted dashboard
- Testnet deployment: pending credentials and Testnet gas
- README: complete
- Submission narrative: `docs/submission.md`

## Remaining Manual Steps

1. Make the GitHub repository public.
2. Create/fund a Casper Testnet key.
3. Set `CASPER_TESTNET_PUBLIC_KEY` and `CASPER_TESTNET_SECRET_KEY_PATH` in `.env`.
4. Run `pnpm contract:deploy:testnet`.
5. Copy the real deployment hash and contract hash into docs.
6. Run `pnpm proof:testnet`.
7. Copy the real proof hash/link into docs.
8. Record the demo video using `docs/video-script.md`.
9. Submit DoraHacks.
