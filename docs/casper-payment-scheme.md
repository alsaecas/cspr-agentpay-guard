# Casper payment scheme

Status: implementation contract for the first guarded Testnet path.

## Decision

AgentPay Guard uses `casper-js-sdk` **5.0.12**, pinned in the Casper adapter package. It is the official TypeScript SDK, supports this TypeScript/ESM monorepo, and exposes `NativeTransferBuilder`, `Transaction`, `RpcClient`, and the Casper 2.0 RPC response types used here.

The payment is a native CSPR transfer, not CEP-18. Amounts are positive base-10 integer **motes** (1 CSPR = 1,000,000,000 motes). The transaction is Casper 2.0 **TransactionV1**, built with `NativeTransferBuilder.build()`; legacy Deploy is not used by this path.

The only supported network is the Testnet chain name `casper-test`. The x402 network selector is the project scheme identifier `casper:casper-test`; it is normalized to the signed chain name. A destination is either a tagged Casper public key (`01` Ed25519 or `02` Secp256k1) or an account hash. The builder uses `target` for a public key and `targetAccountHash` for an account hash.

## Signed intent and transaction

`CasperPaymentAuthorization` canonically binds every payment-relevant value: version, payment ID, policy ID, agent ID, request and body hashes, merchant, destination, chain, asset, amount, nonce, transfer ID, issue/expiry times, facilitator, and hash of the selected x402 requirement. Canonical JSON sorts object keys, omits no defined fields, and is domain-separated with `CSPR_AGENTPAY_CASPER_AUTHORIZATION_V1` before BLAKE2b-256 hashing.

The authorization hash is the local idempotency key. The numeric transfer ID is deterministically derived from the first 52 bits of the payment ID so it fits the official SDK's JavaScript `number` API. TransactionV1 signs the initiator, timestamp, TTL, chain name, pricing mode/payment, native target, amount and transfer ID through the SDK transaction hash. The authorization itself is signed separately by the same Casper key; both signature and transaction must match before submission.

The transaction is submitted once with JSON-RPC `account_put_transaction` through `RpcClient.putTransaction`. RPC acceptance is only `submitted`, never settlement. Bounded polling calls `info_get_transaction` via `getTransactionByTransactionHash` until independent execution information reports success or failure.

## Independent verification

Verification reads Casper RPC data, not the payment header or facilitator claim. It requires:

- the exact transaction hash and successful execution;
- chain name `casper-test`;
- initiator/signer equal to the configured agent public key;
- native transfer entry point;
- exact destination, amount and transfer ID from TransactionV1 arguments;
- a transaction hash not already consumed by another authorization;
- execution timestamp no later than authorization expiry when the RPC supplies it.

The verifier returns only fields present in trusted RPC data. Block hash, height, timestamp and confirmation count remain optional if the node response cannot establish them. CSPR.cloud is optional secondary indexing/explorer infrastructure and is never the primary settlement authority.

## Replay and recovery

An atomic file-backed real-mode store records `prepared`, `submitted`, `confirmed`, or `failed` by authorization hash. Mock and real stores use different files. Per-process locking plus atomic rename prevents concurrent duplicate submissions; corrupt state fails closed. A request retried after uncertainty looks up the stored hash and queries RPC before any further action. A separate consumed-transaction mapping prevents one transaction satisfying two payments.

The store is demo durability, not production distributed idempotency. Multiple hosts require a transactional database or equivalent single-writer service.

## x402 boundary

The `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` headers and v2 envelope are official x402 behavior. Native-CSPR authorization fields, canonical hashing, TransactionV1 evidence encoding, direct Casper RPC verification, and the `casper:casper-test` selector are **AgentPay Guard project scheme behavior**; this repository does not claim an official Casper x402 scheme or facilitator.

Required services for live mode are a Casper Testnet RPC endpoint and a funded local signing key. CSPR.cloud and the existing proof-recorder contract are optional. Proof anchoring is a distinct transaction and never gates access after payment settlement is already verified.

## Deliberate limits

This milestone does not implement Mainnet, CEP-18, custody, escrow, refunds, distributed signing, multi-host idempotency, merchant onboarding, an official x402 facilitator, or production key management. Hosted Vercel UI does not sign. A live local payment is always gated by a dry run, full validation, printed intent, and separate explicit human confirmation.

Sources: [official Casper JS SDK guide](https://docs.casper.network/developers/dapps/sdk/script-sdk), [Casper 2.0 transactions](https://docs.casper.network/condor/transactions), [TransactionV1 RPC types](https://docs.casper.network/developers/json-rpc/types_chain), and [`info_get_transaction`](https://docs.casper.network/condor/jsonrpc-comp/info_get_transaction).
