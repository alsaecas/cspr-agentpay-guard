# Final-Round Implementation Plan

## Objective

Turn the completed guarded Testnet foundation into a judge-ready Agentic RWA product without increasing payment or contract risk.

## Verified starting point

- Qualified BUIDL registered for the Final Round.
- One policy-authorized 2.5 CSPR payment completed exactly once.
- Native TransactionV1 execution succeeded at block 8510676.
- Independent RPC verification preceded MAD-001 release.
- Official x402 v2 transport is implemented through `@x402/core`.
- The native-CSPR payload remains a project-specific scheme.
- A separate Odra proof recorder and existing proof transaction are public.
- Hosted Vercel code has no signer or private key.

## Current architecture

```text
Agent or MCP client
-> protected MAD-001 endpoint
<- PAYMENT-REQUIRED
-> normalized authoritative requirement
-> deterministic guard
-> local signer and Casper submitter (real path only)
-> independent RPC verification
-> PAYMENT-SIGNATURE retry
<- HTTP 200 + PAYMENT-RESPONSE
-> audit surface
```

Hosted Judge Mode executes only deterministic authorization scenarios. It does not cross the signer boundary.

## Milestone workstreams

### 1. MCP as a judge feature

- Add a complete MAD-001 RWA journey tool.
- Add scenario evaluation with stable reason codes.
- Add a read-only verified evidence tool.
- Add a security model tool.
- Preserve legacy lifecycle tools with accurate demo labels.
- Prove discovery and calls through an actual MCP client/server transport.

Acceptance: `pnpm demo:mcp:judge` shows ALLOW, payee-substitution DENY, replay REJECTED, existing payment evidence, and hosted signing disabled.

### 2. Dedicated Judge Mode

- Add `/judge` and prominent navigation.
- Explain the product in under three minutes.
- Show architecture, three decisions, payment evidence, MCP tools, and the real-versus-hosted boundary.
- Include no live-spend action.

Acceptance: route builds without secrets, remains responsive, and exposes all public evidence.

### 3. Submission and video alignment

- Prepare exact DoraHacks copy.
- Rewrite 3-minute and 90-second scripts.
- Automate silent browser capture around Judge Mode.
- Remove current stale claims while preserving legacy protocol terminology.

Acceptance: no recording instruction submits payment, proof, or deployment.

### 4. Validation

- Extend content checks for hashes, required routes, MCP command, Mainnet/production overclaims, and links.
- Run full code, contract, dry-run, browser, build, and security checks.
- Scan tracked changes for secrets and local paths.

## No-risk constraints

- No additional Casper payment.
- No additional Odra proof transaction.
- No contract deployment.
- No key generation or rotation.
- No hosted signing or spending control.
- No manual deployment or DoraHacks update from automation.

## Completion boundary

This milestone ends at a draft PR. Merge, production deployment, final voiceover, video upload, and DoraHacks content refresh remain manual actions.
