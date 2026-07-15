# Casper Testnet Status

## Current state

The project has two separate public Casper Testnet evidence paths:

1. one policy-authorized native-CSPR payment; and
2. one Odra proof-recorder deployment with an existing proof transaction.

They are not the same transaction and must not be described as the same settlement event.

## Guarded payment

| Field | Value |
|---|---|
| Status | verified |
| Network | `casper-test` |
| Transaction | `801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f` |
| Amount | 2.5 CSPR |
| Block | 8510676 |
| Execution | succeeded |
| Submission | exactly once |
| Payment response | verified |
| Premium MAD-001 data | released after verification |

Public source: [machine-readable evidence](evidence/first-guarded-testnet-payment.json) and [evidence report](evidence/first-guarded-testnet-payment.md).

The paid API reconstructed the authorization from its own issued requirement, verified the signature, independently queried Casper RPC, matched the expected signer, payee, amount, and transfer ID, and marked the transaction consumed before returning premium data.

## x402 boundary

The guarded exchange uses official x402 v2 transport headers through `@x402/core`:

```text
PAYMENT-REQUIRED
-> deterministic authorization
-> native-CSPR TransactionV1
-> independent RPC verification
-> PAYMENT-SIGNATURE
-> HTTP 200
-> PAYMENT-RESPONSE
```

The native-CSPR payload is the project-specific `agentpay-casper-native-v1` scheme, not an official Casper x402 standard.

## Separate Odra proof recorder

| Field | Value |
|---|---|
| Contract | `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01` |
| Package | `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010` |
| Deployment | `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c` |
| Existing proof | `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409` |

The contract records audit/proof fields. It does not transfer CSPR and is not payable escrow, custody, or payment settlement.

## Safe validation

```bash
pnpm proof:testnet:dry-run
pnpm demo:testnet:guarded:dry-run
pnpm contract:test
```

The milestone validation uses dry runs only. No reviewer needs to submit another payment, proof, or deployment.

## Hosted boundary

Vercel has no private key, signer, or spending control. Judge Mode reads committed public evidence and executes deterministic scenarios. A hosted ALLOW decision does not claim that a new Testnet transaction occurred.

## Limitations

- Testnet only; no Mainnet claim.
- One completed guarded native-CSPR payment, not a production payment service.
- No custody, payable escrow, refunds, or production settlement system.
- No independent security audit.
- No official Casper x402 scheme claim.
- No official Casper MCP server claim.
