# Guarded x402 Integration

## Status

AgentPay Guard uses official x402 v2 transport objects and headers through `@x402/core`. The payment payload is a project-specific native-CSPR scheme named `agentpay-casper-native-v1`.

The transport is official x402. The Casper payload is not claimed as an official Casper x402 standard.

## Real guarded flow

```text
GET /premium/rwa/parking-asset/MAD-001
<- HTTP 402 + PAYMENT-REQUIRED
-> normalize the server-issued requirement
-> deterministic GuardedPaymentRequest evaluation
-> local signing boundary
-> native-CSPR TransactionV1 submission
-> recover exact transaction result if RPC response is ambiguous
-> independent RPC verification
-> retry with PAYMENT-SIGNATURE
<- HTTP 200 + PAYMENT-RESPONSE + premium MAD-001 data
```

Submission is exact-once. Unknown execution state never becomes success and never authorizes a blind resubmission.

## Authoritative requirement

The model does not supply trusted payment fields. The protected server-issued requirement is authoritative. AgentPay Guard checks:

1. requirement integrity;
2. merchant allowlist;
3. exact payee;
4. exact resource, method, and body binding;
5. per-payment amount limit;
6. remaining budget;
7. expiry;
8. request hash; and
9. consumed transaction and replay state.

Only ALLOW can reach the local signer boundary.

## Header roles

- `PAYMENT-REQUIRED`: server-issued x402 v2 payment requirement.
- `PAYMENT-SIGNATURE`: client payment payload on the retry.
- `PAYMENT-RESPONSE`: server confirmation returned with the protected response.

Legacy `X-AgentPay-Receipt` support exists only in the older deterministic mock lifecycle and is intentionally not accepted by the real guarded MAD-001 endpoint.

## Request binding

The authorization binds policy, agent, merchant, normalized requirement, payee, amount, resource, method, body hash, request hash, expiry, and nonce. A receipt or transaction for a different URL, method, body, or requirement fails closed.

## Prompt injection

Prompt text cannot overwrite the server-issued payee or amount. A substitution scenario returns `PAYEE_MISMATCH`, does not call the signer, does not call the submitter, and does not mutate budget.

## Replay

Consumed transaction hashes are persisted at the adapter boundary. The verifier rejects an already consumed transaction before premium data is returned. Requirement nonces and payment IDs provide additional replay binding.

## Real evidence

Transaction `801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f` transferred 2.5 CSPR on `casper-test`, succeeded at block 8510676, and unlocked MAD-001 only after independent verification.

See [the evidence report](evidence/first-guarded-testnet-payment.md).

## Hosted mode

Hosted Judge Mode reconstructs the decision path using deterministic scenarios. It has no key or signer and never submits. Public evidence is loaded read-only from the repository.

## Odra separation

The existing Odra proof transaction is separate from the native-CSPR payment. The proof recorder is an audit component, not payment settlement, escrow, or custody.

## Limitations

The current implementation is a Testnet prototype. It is not an official Casper x402 scheme, Mainnet deployment, production settlement service, custody product, or audited payable escrow.
