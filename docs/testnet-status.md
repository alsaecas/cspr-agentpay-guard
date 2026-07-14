# Casper Testnet Integration Status

Last updated: 2026-07-14

## Current State

State C — **Deployed on Casper Testnet with one proof transaction submitted**.

The repository has a buildable Odra proof-recorder contract, generated wasm/schema artifacts, a guarded Testnet deploy command, and a guarded real proof submission command. The `AgentPayProofRecorder` contract is deployed on Casper Testnet, and one `record_proof` call has executed successfully.

The final-round guarded x402 foundation does not change this status: no real x402 CSPR payment settlement has been submitted. The existing Testnet transactions remain proof-recorder evidence only.

## Status Table

| Item | Status | Evidence |
|---|---|---|
| Contract source | Done | `contracts/agentpay-guard/src/lib.rs` |
| Odra project manifest | Done | `contracts/agentpay-guard/Odra.toml` |
| Contract wasm artifact | Done | `contracts/agentpay-guard/wasm/AgentPayProofRecorder.wasm` |
| Contract schema artifact | Done | `contracts/agentpay-guard/resources/casper_contract_schemas/agent_pay_proof_recorder_schema.json` |
| Contract check | Done | `pnpm contract:check` passes |
| Contract build | Done | `pnpm contract:build` passes |
| Proof dry-run | Done | `pnpm proof:testnet:dry-run` passes |
| Real Testnet deployment | Done | [CSPR.live deploy](https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c) |
| Real proof transaction | Done | [CSPR.live proof](https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409) |
| Contract hash | Done | `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01` |
| Package hash | Done | `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010` |
| Deployment transaction | Done | `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c` |
| Proof transaction | Done | `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409` |

## What The Contract Records

`AgentPayProofRecorder.record_proof` records:

- `payment_id`
- `request_hash`
- `policy_id`
- `merchant_id`
- `status`
- optional `receipt_hash`
- caller address
- block time

Validation:

- Empty `payment_id` is rejected.
- Empty `request_hash` is rejected.
- Duplicate `payment_id` is rejected.
- Status must be one of `authorized`, `escrowed`, `fulfilled`, or `settled`.

This is a proof/audit anchor. It does not transfer CSPR, custody funds, or implement production escrow.

## Commands

```bash
pnpm proof:testnet:dry-run
pnpm contract:check
pnpm contract:build
pnpm contract:deploy:testnet
pnpm proof:testnet
```

Expected behavior without credentials:

- `proof:testnet:dry-run` succeeds and submits nothing.
- `contract:deploy:testnet` fails with missing key setup instructions.
- `proof:testnet` fails with missing key/contract hash setup instructions.

## Required Environment

Copy `.env.example` to `.env` and fill only local secrets. Never commit `.env` or PEM files.

```bash
CASPER_NETWORK=casper-test
CASPER_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_NODE_SSE_URL=

CASPER_TESTNET_PUBLIC_KEY=<public_key_hex>
CASPER_TESTNET_SECRET_KEY_PATH=/absolute/path/to/secret_key.pem

CASPER_DEPLOY_GAS_MOTES=500000000000
CASPER_PROOF_GAS_MOTES=5000000000

CASPER_AGENTPAY_CONTRACT_HASH=<set after deployment>
CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=<set after deployment>
```

## Reproduction Steps

1. Create or choose a Casper Testnet keypair.
2. Fund the account from the Casper Testnet faucet. The CSPR.live faucet requires signing in with Casper Wallet.
3. Set `CASPER_TESTNET_PUBLIC_KEY` and `CASPER_TESTNET_SECRET_KEY_PATH` in `.env`.
4. Run `pnpm contract:check`.
5. Run `pnpm contract:build`.
6. Run `pnpm contract:deploy:testnet`.
7. Copy the real deployment deploy hash and CSPR.live Testnet URL from the command output.
8. After execution, find the installed contract/package hash from the execution result or account named keys.
9. Set `CASPER_AGENTPAY_CONTRACT_HASH` in `.env`.
10. Run `pnpm proof:testnet`.
11. Copy the real proof deploy hash and CSPR.live Testnet URL from the command output.
12. Update this file, `README.md`, `docs/submission.md`, and `docs/final-checklist.md` with only the real hashes.

## Current Testnet Values

| Field | Value |
|---|---|
| Contract deployed | Yes |
| Contract hash | `2f3dc02eb40c42701609db6ee1a3557d437a68014deb01f46ab658e0a57e1a01` |
| Package hash | `d5587b9875c2e1090d65dd20bdd8eade6f3f8d97792525ecffc3b90506aef010` |
| Deployment transaction | `b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c` |
| Proof transaction submitted | Yes |
| Proof transaction | `9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409` |
| CSPR.live deployment link | https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c |
| CSPR.live proof link | https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409 |
| Proof block height | `8395592` |
| Proof `paymentId` | `3fbf28b266b5b93b59ec44c2d86b9bbc85b5859924a737a1e0468fe70c9ef5ae` |
| Proof `requestHash` | `59c91e0431a40afdcc32b43a5a67b057299098622767a240470b1f67e062319b` |

## Reproduction After Real Deployment

```bash
pnpm proof:testnet
```

The command should print:

- submitted status
- real deploy hash
- CSPR.live Testnet link

If it does not print a real hash, do not document one.

## Honest Limitations

- CSPR.cloud indexing is not implemented.
- CSPR.click is not implemented.
- The proof-recorder contract is not payable escrow.
- Mock-mode hashes are deterministic local `mock-*` values and must never be shown as Casper transaction hashes.
