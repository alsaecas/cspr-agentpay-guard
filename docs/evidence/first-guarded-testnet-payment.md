# First guarded Casper Testnet payment

Status: **verified**  
Executed: 2026-07-15  
Starting commit: `c4054b9` (`set Vercel app root`), on branch `final-round/live-testnet-evidence`

AgentPay Guard completed one real, policy-authorized native-CSPR payment on Casper Testnet. The protected API released premium data only after independently reconstructing the authorization, verifying its signature, and confirming the TransactionV1 settlement through Casper RPC.

## Guarded flow

1. `GET /premium/rwa/parking-asset/MAD-001` returned HTTP 402 and an official x402 v2 `PAYMENT-REQUIRED` header.
2. Every deterministic policy check passed, including exact network, asset, payee, merchant, resource, amount, budget, expiry, request/body hashes, nonce, and facilitator.
3. A dedicated local Ed25519 Testnet key signed the immutable authorization and TransactionV1. The hosted Vercel application never loaded the key.
4. Exactly one transaction was submitted. Casper RPC independently established the signer, chain, destination, amount, transfer ID, block, timestamp, and successful execution.
5. The client retried with `PAYMENT-SIGNATURE`. The paid API reconstructed the server-issued authorization, verified the authorization signature, independently re-read Casper RPC, persisted transaction consumption, returned HTTP 200 with `PAYMENT-RESPONSE`, and released the MAD-001 report.

## Public settlement evidence

| Field | Value |
|---|---|
| Transaction | [`801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f`](https://testnet.cspr.live/transaction/801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f) |
| Network | `casper-test` |
| Type | Casper 2.0 `TransactionV1`, native transfer |
| Execution | `succeeded`; RPC `error_message` was `null` |
| Signer | `01336f14a3c431deec7041a9f4d64d7a2675b727c5150050963ccbb4f56a254d69` |
| Signer account hash | `a25198a08bcaa9a861edc88db374123469a1349cf2a55e3529a3e4430efcce13` |
| Payee | `01e16a6a8992000821589fc26d00bc63c1c06e636765e27bba3b8df99f302c8ec6` |
| Payee account hash | `40ccfcd1c883b9b6241dc73dba2c13e852b9ea859bc50c244dbb940f63f297b4` |
| Amount | `2,500,000,000` motes (2.5 CSPR) |
| Transfer ID | `2230876648738645` |
| Block | `8510676` / `d9a302d8521dc0c0dad241269311ed8b25c0ce3f4baf67522716194386840740` |
| Transaction timestamp | `2026-07-15T08:59:29.513Z` |
| Request hash | `199ec14c9d2ed2cd873a75b58a483384440367240317b5d35f7bb1c93d313c29` |
| Authorization | `dd6f6b5e7d4383bf400cd40e9e3a139bfcdfa48fda873ad19b55463c60807642` |
| Payment ID | `7ecf8722f8f553c86018bfd464653ad82492cea32ff0f3555300cb77a8cad030` |

## Balance evidence

| Account | Before | After | Observed change |
|---|---:|---:|---:|
| Payer | 5,000,000,000,000 motes | 4,997,400,000,000 motes | -2,600,000,000 motes |
| Payee | 5,000,000,000,000 motes | 5,002,500,000,000 motes | +2,500,000,000 motes |

Casper RPC reported a transaction cost of 100,000,000 motes. The payer change equals the independently observed transfer plus that reported cost.

## Recovery record

The first local status poll incorrectly treated the presence of the JSON key `error_message` as failure even though its value was `null`. The transaction had already succeeded on-chain. The transaction hash and idempotency state were preserved, the classifier was corrected to inspect the actual SDK error value, and recovery queried the existing hash without another submission. Regression tests cover null and non-null execution errors.

## Real versus simulated

This payment, its policy decision, local signatures, TransactionV1 settlement, RPC verification, balance changes, `PAYMENT-RESPONSE`, and premium response are real Testnet/local-service evidence. The hosted interactive scenarios remain deterministic simulations and never sign or spend. The existing Odra proof recorder is a separate on-chain proof path; no additional proof-recorder transaction was authorized or submitted for this payment.

This is the project-specific `agentpay-casper-native-v1` scheme carried in official x402 v2 transport headers. It is not an official Casper x402 standard, Mainnet workflow, custody system, escrow product, or audited production payment service.
