# Final Checklist — CSPR AgentPay Guard

Last updated: 2026-07-14

## GitHub / Submission

- [x] GitHub repo public: `https://github.com/alsaecas/cspr-agentpay-guard`
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
pnpm test                            # pass, 172 tests
pnpm demo:mock                       # pass
pnpm --filter @cspr-agentpay/web build  # pass
```

## Dashboard

- [x] Dashboard command documented
- [x] Vercel-safe self-contained dashboard backend documented
- [x] Mock mode visibly labeled
- [x] Testnet proof status card present
- [x] Optional hosted dashboard URL: `https://cspr-agentpay-guard.vercel.app`
- [x] Guarded x402 scenario model exposes ALLOW/DENY, checks, reason, budget delta, adapter call status, and mode
- [x] Allowed-payment, prompt-injection-attack, and replay-attack verified in a local browser

## Guarded x402 Foundation

- [x] Official `@x402/core` v2 transport types and header codecs pinned
- [x] Normalized `GuardedPaymentRequest` and canonical integrity checks
- [x] Network, asset, exact payee, merchant, resource, price, budget, expiry, request/body hash, nonce, facilitator, and optional policy-signature checks
- [x] Signer/facilitator path is never called after a denial
- [x] Real Casper x402 adapter fails closed without an injected verified Casper signer and facilitator
- [x] No real x402 CSPR settlement claimed

Dashboard commands:

```bash
pnpm --filter @cspr-agentpay/web dev
```

Optional external paid-api mode:

```bash
AGENTPAY_DEMO_BACKEND=external pnpm --filter @cspr-agentpay/paid-api dev
AGENTPAY_DEMO_BACKEND=external pnpm --filter @cspr-agentpay/web dev
```

## Casper Testnet

```bash
pnpm proof:testnet:dry-run      # pass
pnpm contract:check             # pass
pnpm contract:build             # pass
pnpm contract:test              # pass, 8 tests
pnpm contract:deploy:testnet    # pass; deployed on Casper Testnet
pnpm proof:testnet              # pass; submitted one record_proof call
```

Status:

- [x] Contract source exists
- [x] Odra manifest exists
- [x] Contract schema generated
- [x] Contract wasm generated
- [x] Dry-run proof works without credentials
- [x] Deploy script fails safely when credentials are missing
- [x] Proof script fails safely when credentials or contract hash are missing
- [x] Contract deployed to Casper Testnet: `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- [x] Contract hash documented: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- [x] Package hash documented: `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010`
- [x] Deployment transaction link documented: `https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- [x] Proof transaction submitted: `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`
- [x] Proof transaction link documented: `https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`

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
- Live demo: `https://cspr-agentpay-guard.vercel.app`
- Testnet deployment: complete with deployment/proof links in `docs/testnet-status.md`
- README: complete
- Submission narrative: `docs/submission.md`

## Remaining Manual Steps

1. Record the demo video using `docs/video-script.md`.
2. Submit DoraHacks.
