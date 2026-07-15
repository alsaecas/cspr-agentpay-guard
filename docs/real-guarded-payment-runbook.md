# Real guarded payment runbook

## Setup and funding

Use a dedicated, low-value Casper Testnet account. Put its secret PEM outside the repository with owner-only permissions. Configure the variables documented in `.env.example`, including the tagged `CASPER_TESTNET_PUBLIC_KEY` and `AGENTPAY_CONSUMED_TRANSACTIONS_PATH=.agentpay/consumed.real.json`; the PEM path never reaches the browser or logs. The signer may be Ed25519 or Secp256k1. Fund enough for the configured transfer plus network payment cost. The sample transfer is 2,500,000,000 motes (2.5 CSPR) and the builder payment limit defaults to 100,000,000 motes (0.1 CSPR), but the actual fee and minimum are network/chainspec-controlled—verify current Testnet values before approval.

Start the paid API on port 4000, then run:

```bash
pnpm demo:testnet:guarded:dry-run
```

With complete configuration, this fetches the actual 402, runs every guard, builds and signs the exact TransactionV1, prints only public intent and hashes, and submits nothing. Without configuration it reports all missing fields and exits without loading a key.

## Live gate

Run all repository validation first. Review signer, payee, motes, network, resource, authorization hash and transaction hash. Only after explicit approval, run the command printed by the gate:

```bash
pnpm demo:testnet:guarded -- --confirm-authorization <reviewed-authorization-hash>
```

RPC acceptance is not success. The command polls execution, then independently reads TransactionV1 and checks signer, chain, destination, amount and transfer ID. Verify the resulting hash at `https://testnet.cspr.live/transaction/<hash>`.

## Timeout and duplicate safety

After a timeout, do not clear state and do not repeat the transfer manually. Inspect `.agentpay/submissions.real.json`, take its transaction hash, and query Casper RPC/explorer. Re-running the same active authorization performs status lookup and cannot call submission twice. The paid API separately persists verified consumption in `.agentpay/consumed.real.json`; keep both files. Corrupt state fails closed.

Clear only non-secret demo state when there is no prepared/submitted transaction under investigation:

```bash
rm .agentpay/submissions.real.json
```

Never delete either store to work around uncertainty. These files provide local single-host durability; production would require a transactional shared database. The server signs and verifies the raw 32-byte authorization hash, not its UTF-8 hexadecimal text.

## Key rotation

Stop local services, resolve all pending hashes, create/fund a new dedicated Testnet key, update the public key and external PEM path together, run dry-run again, then securely retire the old key. Never copy PEM content into `.env`, command arguments, logs, screenshots, or the repository.

Payment proof anchoring may be submitted afterward through the existing recorder, but it is a separate optional transaction and does not change payment settlement.
