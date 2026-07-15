# DoraHacks Final-Round Update — Paste-Ready Copy

## Title

CSPR AgentPay Guard — Zero-Trust Authorization for Agentic x402 Payments

## One-liner

A zero-trust authorization layer for x402 that lets autonomous AI agents buy protected APIs under deterministic policy and independently verified Casper settlement.

## Problem

AI agents need to buy APIs, data, and compute, but model output cannot be trusted with unrestricted wallet control. A prompt injection that changes the payee, amount, resource, or request must be stopped before signing.

## Solution

AgentPay Guard sits between an agent, x402, and the wallet. It reconstructs the authoritative server-issued requirement and deterministically checks merchant, payee, resource, amount, budget, integrity, expiry, nonce, and replay state. Only an exact policy match may cross the signer boundary.

## Why Agentic AI

The agent discovers that premium information is payment-gated, receives HTTP 402, calls project-owned MCP tools to evaluate the requirement, and continues without human checkout. The model chooses the task; policy code controls whether a wallet action is permitted.

## RWA use case

An autonomous RWA due-diligence agent requests premium data for the tokenized MAD-001 parking asset. The provider returns HTTP 402, but the model never controls the wallet directly. AgentPay Guard validates the exact payee, resource, amount, budget, expiry, and request integrity before signing. Prompt-injection and replay attempts fail before submission.

## How x402 is used

The guarded path uses official x402 v2 transport objects and `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` headers through `@x402/core`. The native-CSPR payload is the project-specific `agentpay-casper-native-v1` scheme; it is not claimed as an official Casper x402 standard.

## How MCP is used

The project owns an MCP server built with the official Model Context Protocol SDK. MCP-compatible agents run the existing guarded x402 normalization, policy evaluation, no-spend settlement adapter, paid retry, and PAYMENT-RESPONSE verification. `pnpm demo:mcp:judge` performs a real MCP client/server handshake and never constructs or calls a real signer or submitter.

## Casper integration

One real policy-authorized native-CSPR TransactionV1 transferred 2.5 CSPR exactly once on Casper Testnet. The exact authorization destination was the tagged public key `01e16a6a8992000821589fc26d00bc63c1c06e636765e27bba3b8df99f302c8ec6`, whose derived account hash is `40ccfcd1c883b9b6241dc73dba2c13e852b9ea859bc50c244dbb940f63f297b4`. The resource server independently verified the expected signer, payee, amount, transfer ID, execution success, and request-bound authorization before returning premium data. A separate Odra `AgentPayProofRecorder` provides public audit/proof evidence and is not payment settlement.

## Architecture

Agent task → HTTP 402 → requirement normalization → deterministic guard → local signer boundary → native-CSPR TransactionV1 → independent Casper RPC verification → PAYMENT-RESPONSE → premium RWA data. Hosted Judge Mode runs the same decision story with deterministic no-spend scenarios.

## Security model

- Model output cannot choose an arbitrary payee.
- Server-issued payment requirements are authoritative.
- Exact request and body hashes are checked.
- Merchant, payee, resource, amount, budget, integrity, and expiry checks run before signing.
- Unknown execution state never becomes success.
- Transaction and receipt replay are rejected.
- Hosted Vercel mode has no signer, keys, or spending capability.

## What is real

- One verified 2.5 CSPR native TransactionV1 on Casper Testnet.
- Exact-once submission and independent RPC verification.
- Premium MAD-001 data released after verified PAYMENT-RESPONSE.
- Deployed Odra proof recorder and one separate proof transaction.
- Project-owned MCP server using the official MCP SDK.

## What remains deterministic

The public hosted scenarios and MCP judge journey execute the actual guard code with an injected no-spend adapter and deterministic premium response. They invoke no real signer, load no private key, submit no transaction, and move no funds. The historical real Testnet premium release remains separate public evidence.

## Transaction evidence

- Payment: `801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f`
- Amount: 2.5 CSPR
- Block: 8510676
- Execution: succeeded
- Explorer: https://testnet.cspr.live/transaction/801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f

## Contract evidence

- Contract: `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01`
- Deployment: `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
- Existing proof: `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`

## Technical stack

TypeScript, Node.js, Next.js, `@x402/core`, `casper-js-sdk`, Odra Framework, Rust, Model Context Protocol SDK, Vitest, Playwright, Casper Testnet, and Vercel.

## Repository

https://github.com/alsaecas/cspr-agentpay-guard

## Live demo

https://cspr-agentpay-guard.vercel.app

## Video

`[ADD FINAL PUBLIC VIDEO URL AFTER UPLOAD]`

## Setup commands

```bash
pnpm install
pnpm demo:mcp:judge
pnpm --filter @cspr-agentpay/web dev
```

No private key or paid API is required for the MCP judge command or hosted Judge Mode.

## Judge instructions

1. Open `/judge` from the live site.
2. Read the three scenarios and no-spend boundary.
3. Inspect the verified payment transaction.
4. Run `pnpm demo:mcp:judge` or inspect its tests.
5. Confirm payee substitution and replay are denied before signing.
6. Inspect the separate Odra proof transaction.

## Roadmap

Harden wallet integrations, expand policy administration, add production operational monitoring, and seek independent security review before any Mainnet or custody use.

## Limitations

This is a Testnet hackathon prototype, not a security audit, production custody product, payable escrow system, or Mainnet deployment. The project does not claim an official Casper x402 scheme or official Casper MCP server.
