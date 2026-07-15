# DoraHacks Submission — CSPR AgentPay Guard

## Title

CSPR AgentPay Guard — Zero-Trust Authorization for Agentic x402 Payments

## One-Liner

A zero-trust authorization layer for x402 that lets autonomous AI agents buy protected APIs under deterministic policy and independently verified Casper settlement.

## Problem

Autonomous agents need paid APIs and data, but language-model output cannot safely control an unrestricted wallet. Prompt injection can attempt to change the payee, amount, or resource after the agent decides to buy.

## Solution

AgentPay Guard reconstructs the server-issued payment requirement and checks merchant, payee, resource, amount, budget, integrity, expiry, nonce, and replay state before signing. The model controls the task; deterministic policy controls the wallet boundary.

## Agentic AI and RWA

An autonomous due-diligence agent requests premium data for tokenized parking asset MAD-001. The provider returns HTTP 402. An MCP-compatible agent evaluates the requirement, proceeds on ALLOW, or receives a stable denial code. Payee substitution and replay fail before signing.

## Architecture

```text
Agent task
-> protected MAD-001 API
<- HTTP 402 / PAYMENT-REQUIRED
-> AgentPay Guard deterministic checks
-> local signer boundary (real path only)
-> native-CSPR TransactionV1
-> independent RPC verification
-> PAYMENT-SIGNATURE retry
<- HTTP 200 / PAYMENT-RESPONSE / premium data
```

## x402 integration

Official x402 v2 transport objects and headers are used through `@x402/core`. The `agentpay-casper-native-v1` payload is project-specific and is not claimed as an official Casper x402 scheme.

## MCP integration

The project owns an MCP server built with the official Model Context Protocol SDK. The real MCP protocol exposes the MAD-001 journey, safe payment evaluation, public Testnet evidence, and security invariants. It is not an official Casper MCP server.

```bash
pnpm demo:mcp:judge
```

The command uses an actual MCP client/server connection and requires no key, credentials, paid API, or funds.

## Casper integration

One native-CSPR TransactionV1 transferred 2.5 CSPR exactly once on Casper Testnet. The resource server independently verified execution, signer, payee, amount, transfer ID, and request binding before releasing premium MAD-001 data.

The Odra `AgentPayProofRecorder` is a separate public audit/proof path. It is not the payment, settlement, escrow, or custody.

## Public evidence

- Payment: `801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f`
- Contract: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- Deployment: `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- Existing proof: `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`
- Evidence report: [first guarded Testnet payment](evidence/first-guarded-testnet-payment.md)

## What Is Real vs Mock

| Capability | Status |
|---|---|
| Policy engine, request binding, x402 transport, MCP protocol | Real implementation |
| Hosted Judge Mode | Deterministic and no-spend |
| Guarded Testnet payment | One real independently verified TransactionV1 |
| Odra proof recorder | Separate real deployment and existing proof |
| Native-CSPR scheme | Project-specific |
| Production custody, payable escrow, Mainnet, audit | Not implemented or claimed |

## Security invariants

- Model output cannot choose an arbitrary payee.
- Server-issued requirements are authoritative.
- Exact request and body hashes are checked.
- Limits and expiry checks run before signing.
- Unknown execution state fails closed.
- Consumed transactions and receipts cannot be replayed.
- Hosted Vercel mode has no signer or private key.

## Technical stack

TypeScript, Node.js, Next.js, `@x402/core`, `casper-js-sdk`, Odra Framework, Rust, Model Context Protocol SDK, Vitest, Playwright, Casper Testnet, and Vercel.

## Links

- Repository: https://github.com/alsaecas/cspr-agentpay-guard
- Live demo: https://cspr-agentpay-guard.vercel.app
- DoraHacks: https://dorahacks.io/buidl/46706
- Final video: `[ADD AFTER MANUAL UPLOAD]`

## Judge instructions

1. Open `/judge`.
2. Compare ALLOW, payee substitution DENY, and replay REJECTED.
3. Inspect the verified payment card and explorer transaction.
4. Run `pnpm demo:mcp:judge`.
5. Inspect the separate Odra proof card.
6. Read the hosted-versus-real boundary.

## Roadmap

Harden wallet integrations and operations, broaden policy administration, and obtain independent security review before any production or Mainnet use.

## Limitations

This is a Testnet hackathon prototype. It is not a security audit, Mainnet deployment, custody product, payable escrow implementation, production settlement service, official Casper x402 scheme, or official Casper MCP server.

For longer paste-ready field copy, use [the final update document](dorahacks-final-update.md).
