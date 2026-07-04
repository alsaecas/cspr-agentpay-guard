# Casper Testnet Integration Status

Last updated: 2026-07-04

## Current State

State B — **Ready but pending external credentials and Testnet gas**.

The repository now has a buildable Odra proof-recorder contract, generated wasm/schema artifacts, a guarded Testnet deploy command, and a guarded real proof submission command. No real Casper Testnet deployment or proof transaction has been submitted in this environment because no funded Testnet secret key/public key was available.

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
| Real Testnet deployment | Pending | Requires funded Testnet key |
| Real proof transaction | Pending | Requires deployed contract hash |
| Contract hash | Pending | Do not fill until deployment is real |
| Deployment transaction | Pending | Do not fill until deployment is real |
| Proof transaction | Pending | Do not fill until proof submission is real |

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
CASPER_RPC_URL=https://node.testnet.cspr.cloud/rpc
CASPER_NODE_SSE_URL=https://node-sse.testnet.cspr.cloud/events/main

CASPER_TESTNET_PUBLIC_KEY=<public_key_hex>
CASPER_TESTNET_SECRET_KEY_PATH=/absolute/path/to/secret_key.pem

CASPER_DEPLOY_GAS_MOTES=50000000000
CASPER_PROOF_GAS_MOTES=5000000000

CASPER_AGENTPAY_CONTRACT_HASH=<set after deployment>
CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=<set after deployment>
```

## Manual Steps To Finish Testnet

1. Create or choose a Casper Testnet keypair.
2. Fund the account from the Casper Testnet faucet.
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

## Current Placeholders

| Field | Value |
|---|---|
| Contract deployed | No |
| Contract hash | Pending |
| Deployment transaction | Pending |
| Proof transaction submitted | No |
| Proof transaction | Pending |
| CSPR.live deployment link | Pending |
| CSPR.live proof link | Pending |

## Reproduction After Real Deployment

Once a real contract hash exists:

```bash
pnpm proof:testnet
```

The command should print:

- submitted status
- real deploy hash
- CSPR.live Testnet link

If it does not print a real hash, do not document one.

## Honest Limitations

- No real Casper Testnet transaction has been submitted in this environment.
- CSPR.cloud indexing is not implemented.
- CSPR.click is not implemented.
- The proof-recorder contract is not payable escrow.
- Mock-mode hashes are deterministic local `mock-*` values and must never be shown as Casper transaction hashes.
