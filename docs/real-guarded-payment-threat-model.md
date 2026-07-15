# Real guarded payment threat model

## Protected assets and trust boundaries

The protected assets are the signing key, Testnet balance, policy budget, premium response, authorization/idempotency records, and settlement evidence. x402 headers and client-provided transaction hashes are untrusted. Casper RPC execution data is authoritative for this milestone; CSPR.cloud and browser/explorer state are optional corroboration.

## Enforced threats

- Client authorization forgery is stopped by reconstructing the complete expected authorization from the server-issued requirement and trusted configuration, requiring exact equality, and verifying its authorization hash signature.
- Requirement mutation is stopped because destination, chain, asset, amount, nonce, request/body hashes, facilitator and the selected requirement hash are in the immutable authorization.
- Prompt injection cannot bypass the deterministic policy engine, and DENY never reaches signer or submitter.
- Duplicate/concurrent calls share an authorization-hash lock and atomic store; an accepted hash is persisted before recovery proceeds.
- A facilitator or client cannot claim settlement: the verifier independently reads RPC and matches signer, destination, amount and transfer ID after successful execution.
- Cross-resource replay is stopped by request hash and server-issued requirement lookup. Historical same-payee/same-amount transfers fail the derived transfer-ID check, while a durable consumed mapping stops one transaction satisfying two authorizations, including after restart.
- Secret leakage is limited by path-only configuration, redacted key errors, ignored PEM files, and a hosted UI that exposes neither paths nor signing actions.
- Pending, missing, failed, malformed and timed-out RPC states fail closed and do not release premium content or commit budget.

## Residual risks

The file-backed submission and consumed stores provide single-host durability and in-process serialization, not distributed consistency or cross-process transactional locking. A malicious or compromised RPC endpoint can lie; production should use a trusted node quorum or independently reconciled indexer. Confirmation depth is reported only when a source can establish it and is not currently required beyond successful inclusion. Local PEM signing is not HSM-grade custody. The transfer ID is truncated to a 52-bit JavaScript-safe integer and therefore has a finite collision risk at high volume. The project-specific x402 Casper payload has not been standardized or audited. Optional proof anchoring is not atomic with payment or content release.
