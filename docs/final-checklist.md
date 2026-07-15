# Final-Round Checklist

## Registration and public surfaces

- [x] Same qualified DoraHacks BUIDL registered for Final Round.
- [x] Public GitHub repository available.
- [x] Stable production URL available.
- [ ] Final BUIDL content refresh pasted manually.
- [ ] Production Judge Mode deployed after PR review and merge.

## Agentic AI and RWA story

- [x] MAD-001 tokenized parking asset is the judge task.
- [x] Agent receives HTTP 402 before premium data.
- [x] Model cannot choose an arbitrary wallet payee.
- [x] Deterministic checks precede the signer boundary.
- [x] Prompt-injection/payee substitution is denied.
- [x] Replay is rejected without premium release.

## MCP

- [x] Project-owned MCP server uses the official Model Context Protocol SDK.
- [x] `agentpay_run_rwa_due_diligence` implemented.
- [x] `agentpay_evaluate_payment` implements judge-safe attack scenarios.
- [x] `agentpay_get_verified_testnet_payment` reads committed public evidence only.
- [x] `agentpay_security_model` exposes fail-closed invariants.
- [x] Actual MCP client/server integration test covers discovery and invocation.
- [x] `pnpm demo:mcp:judge` requires no key or paid API.

## Judge Mode

- [x] `/judge` route implemented.
- [x] Homepage primary CTA points to Judge Mode.
- [x] Demo and navigation link to Judge Mode.
- [x] Three scenarios are concise and visible.
- [x] Verified Testnet payment details and explorer link are visible.
- [x] MCP tools and command are visible.
- [x] Hosted, real payment, and Odra proof boundaries are separate.
- [x] No live-spend control exists.
- [ ] Vercel preview reviewed on desktop and mobile.

## Casper evidence

- [x] Existing payment transaction is public and execution succeeded.
- [x] 2.5 CSPR amount and block 8510676 match committed evidence.
- [x] Premium MAD-001 response was released after independent verification.
- [x] Payment submission occurred exactly once.
- [x] Separate Odra proof-recorder deployment is public.
- [x] Separate existing proof transaction is public.
- [x] Payment and proof are never conflated.
- [x] No new payment or proof is required for judging.

## x402 accuracy

- [x] Official x402 v2 transport headers are described accurately.
- [x] `agentpay-casper-native-v1` is labeled project-specific.
- [x] No official Casper x402 scheme claim.
- [x] No official Casper MCP server claim.
- [x] Current guarded flow uses PAYMENT-REQUIRED, PAYMENT-SIGNATURE, and PAYMENT-RESPONSE.

## Video package

- [x] 3-minute primary script prepared.
- [x] 90-second backup pitch prepared.
- [x] Shot list prioritizes Judge Mode and existing evidence.
- [x] Recording runbook prohibits live commands and secret display.
- [x] Captions file prepared.
- [x] Silent browser recording generated locally at `artifacts/video/cspr-agentpay-browser-demo.webm` and ignored by Git.
- [ ] Voiceover and edit completed manually.
- [ ] Video uploaded manually.
- [ ] Public video URL added to repository and DoraHacks.

## Documentation and submission

- [x] Requirements matrix exists.
- [x] Paste-ready DoraHacks final update exists.
- [x] README makes MCP and Judge Mode first class.
- [x] Reviewer playbook begins with a two-minute path.
- [x] Real-versus-hosted limitations are explicit.
- [ ] Final public links reviewed after deployment and upload.

## Validation

- [x] `pnpm docs:check`
- [ ] `pnpm typecheck` — rerun from the final clean worktree.
- [ ] `pnpm test` — rerun from the final clean worktree.
- [ ] `pnpm --filter @cspr-agentpay/mcp-server test`
- [ ] `pnpm demo:mcp:judge`
- [ ] `pnpm contract:test`
- [ ] `pnpm proof:testnet:dry-run`
- [ ] `pnpm demo:testnet:guarded:check`
- [ ] `pnpm --filter @cspr-agentpay/web build`
- [ ] `pnpm security:check`
- [x] Browser routes checked at desktop and mobile widths.
- [x] Secret scan completed before push.

See latest CI for current status. Do not hard-code a test count here.

## Remaining manual steps

1. Review the Vercel preview.
2. Merge the draft PR only after review.
3. Verify production `/judge` after deployment.
4. Record voiceover and edit the local silent clip.
5. Upload the final video.
6. Add the video URL to current docs and DoraHacks copy.
7. Paste the final DoraHacks update before July 26, 2026 at 23:59.

## Absolute safety gate

Do not submit another Casper payment, another Odra proof, or another contract deployment for this milestone. Never expose private keys, PEM paths, `.env`, wallet state, or tokens.
