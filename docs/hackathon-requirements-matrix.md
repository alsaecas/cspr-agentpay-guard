# Final-Round Requirements Matrix

This matrix maps the documented final-round deliverables and project claims to evidence. It does not add inferred judging criteria.

| Requirement | Implementation | Public evidence | Judge demonstration | Status | Remaining manual action |
|---|---|---|---|---|---|
| Same qualified BUIDL registered | Final Round uses DoraHacks BUIDL 46706 | [DoraHacks BUIDL](https://dorahacks.io/buidl/46706) | Open the registered BUIDL | Done | Refresh final content before deadline |
| Public GitHub | Monorepo with agent, gateway, policy, Casper adapter, MCP, web, contracts, tests, and docs | [Repository](https://github.com/alsaecas/cspr-agentpay-guard) | Inspect source and CI | Done | Merge this PR after review |
| Working prototype | Hosted deterministic scenarios plus local MCP judge flow | [Production site](https://cspr-agentpay-guard.vercel.app) | Open `/judge`, `/demo`, and run `pnpm demo:mcp:judge` | Implemented in PR | Review preview and merge |
| Casper Testnet deployment | Odra `AgentPayProofRecorder` deployed separately from payment | Contract `2f3dc02e…e1a01`; deployment `b03078ff…f3442c` | Open proof card and explorer | Done | None |
| Real public transaction evidence | One policy-authorized 2.5 CSPR native TransactionV1 independently verified | [Evidence report](evidence/first-guarded-testnet-payment.md), [JSON](evidence/first-guarded-testnet-payment.json) | Inspect verified payment card and explorer | Done | None; do not resubmit |
| Live website | Vercel production URL | [Live demo](https://cspr-agentpay-guard.vercel.app) | Open homepage | Done for current main | Deploy Judge Mode by merging PR |
| Demo video | No-spend 3-minute script, 90-second backup, captions, shot list, and recording runbook | [Video script](video-script.md), [runbook](video-recording-runbook.md) | Play final uploaded video | Local package prepared | Record/edit voiceover, upload, paste URL |
| Agentic AI use case | Autonomous due-diligence agent obtains premium MAD-001 data while the model cannot control the wallet | MCP judge tools and `/judge` narrative | Run `agentpay_run_rwa_due_diligence` | Done | Demonstrate in video |
| RWA relevance | Tokenized parking asset due-diligence report for MAD-001 | Agent task, paid resource, judge route | Show premium RWA task and result | Done | None |
| x402 integration | Official x402 v2 transport headers through `@x402/core`; project-specific native-CSPR payload | [x402 integration](x402-integration.md) | Show PAYMENT-REQUIRED → PAYMENT-SIGNATURE → PAYMENT-RESPONSE | Done | Keep wording precise |
| MCP integration | Project-owned server built with the official Model Context Protocol SDK; real client/server judge test | `packages/mcp-server`, `pnpm demo:mcp:judge` | Discover and invoke four judge tools | Done | Show command in video |
| Security and fail-closed design | Payee/resource/amount/budget/integrity/expiry/replay checks precede signing; unknown execution fails closed | MCP security model, tests, threat model | Show prompt injection and replay denied with signer false | Done | None |
| Honest real-versus-demo boundary | Hosted scenarios cannot spend; one separate real payment; Odra proof recorder is not settlement or custody | `/judge`, README, evidence docs | Read the three boundary cards | Done | Preserve during submission edits |

## Two-minute verification path

1. Open `/judge`.
2. Compare ALLOW, payee-substitution DENY, and replay REJECTED.
3. Open the verified native-CSPR transaction.
4. Run `pnpm demo:mcp:judge` and confirm hosted signing is disabled.
5. Open the separate Odra proof transaction.
6. Read the real-versus-hosted boundary.

## Safety boundary

No final-round presentation step requires a new payment or proof transaction. The hosted application has no key material and no live-spend control.
