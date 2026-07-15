# Final-Round Reviewer Playbook

## Two-minute path

1. Open `/judge`.
2. Inspect the ALLOW, payee-substitution DENY, and replay REJECTED scenarios.
3. Inspect the existing verified 2.5 CSPR Testnet payment evidence.
4. Run or inspect `pnpm demo:mcp:judge` and the discovered MCP tools.
5. Inspect the separate Odra proof-recorder deployment and existing proof transaction.
6. Read the hosted-versus-real boundary cards.

That path demonstrates the thesis: **x402 is the payment rail. AgentPay Guard is the authorization layer.**

## Public links

- Repository: https://github.com/alsaecas/cspr-agentpay-guard
- Production: https://cspr-agentpay-guard.vercel.app
- DoraHacks: https://dorahacks.io/buidl/46706
- Payment: https://testnet.cspr.live/transaction/801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f
- Contract deployment: https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c
- Existing proof: https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409
- Final video: `[ADD AFTER MANUAL UPLOAD]`

## Local review

```bash
pnpm install
pnpm demo:mcp:judge
pnpm --filter @cspr-agentpay/web dev
```

Open `http://localhost:3000/judge`. No key, paid API, or Testnet credential is required.

## What the MCP command proves

The command creates a real SDK MCP client and server over an in-memory transport. The tools call the product's existing guarded x402 implementation rather than duplicating decision results. It lists tools and invokes:

- the MAD-001 RWA journey;
- an allowed requirement;
- prompt-injection/payee substitution;
- transaction replay rejection; and
- read-only public Testnet evidence.

Expected safety output includes `Hosted demo submitted: no` and `Hosted signing: disabled`.

## What to look for in Judge Mode

### Allowed request

The authoritative requirement matches policy. Hosted mode reports ALLOW without invoking a signer. The separate verified card proves the real guarded path has completed once.

### Prompt injection

Malicious model output attempts to change the payee or amount. The guard returns a stable denial code before signing, submission, or budget mutation.

### Replay

A consumed requirement nonce cannot unlock a repeated request. The guard returns `NONCE_ALREADY_USED` and releases no deterministic premium response.

## Existing real payment

The public evidence records a 2.5 CSPR native TransactionV1 on `casper-test`, block 8510676, with succeeded execution. Submission happened exactly once. The protected API independently verified the transaction and request-bound authorization before releasing MAD-001.

Do not run a live payment command to review this evidence.

## Separate Odra proof recorder

The Odra `AgentPayProofRecorder` deployment and existing proof transaction are a public audit path. They are not the native-CSPR payment, payable escrow, custody, or settlement.

Do not submit another proof to review this evidence.

## Honest boundaries

| Surface | Meaning |
|---|---|
| Hosted Judge Mode | Deterministic, repeatable, no funds |
| MCP judge command | Real MCP protocol and actual guard logic with an injected no-spend adapter |
| Guarded payment evidence | One real verified Casper Testnet TransactionV1 |
| Odra proof recorder | Separate real audit/proof transaction |
| Native-CSPR x402 payload | Project-specific, not official Casper standardization |

## Why this is Agentic AI

The agent autonomously encounters payment gating and invokes payment-security tools. The language model selects a task, not the wallet destination. Policy and authoritative server data decide whether signing is allowed.

## Why this is RWA

MAD-001 represents a tokenized parking asset. The paid output is premium due-diligence data an agent might need before evaluating or servicing the asset.

## Limitations

This is a Testnet hackathon prototype. It is not Mainnet, a security audit, custody, payable escrow, or a production settlement service. The hosted site cannot spend.
