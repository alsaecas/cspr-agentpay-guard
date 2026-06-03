# Protocol Spec

## Version

Protocol version: `agentpay-guard-v1`

All hashes and IDs must use deterministic canonicalization. Any protocol change that affects canonicalization, hash formulas, or state transitions requires a version bump.

## Canonicalization

Canonical JSON means:

- UTF-8 encoded JSON.
- Object keys sorted lexicographically.
- No insignificant whitespace.
- Integers encoded as decimal JSON numbers when safe, or decimal strings for values larger than JavaScript safe integer range.
- Timestamps encoded as ISO 8601 UTC strings.
- URLs normalized before hashing.

URL normalization means:

- Lowercase scheme and host.
- Remove default ports.
- Preserve path exactly after URL parsing.
- Sort query parameters lexicographically by key, then value.
- Remove fragment.

Header canonicalization is not part of the MVP hash formula. The MVP binds request identity through method, normalized URL, body hash, endpoint ID, merchant ID, agent ID, nonce, and expiry. Selected header binding can be added later as a stretch protocol revision.

## AgentPolicy

An `AgentPolicy` defines what an autonomous agent may pay for.

Required fields:

```json
{
  "version": "agentpay-guard-v1",
  "policyId": "policy_demo_agent_001",
  "ownerAccount": "casper-account-hash-or-public-key",
  "agentId": "agent_research_001",
  "status": "active",
  "currency": "CSPR",
  "maxAmountPerPayment": "2500000000",
  "totalBudget": "10000000000",
  "spentAmount": "0",
  "budgetWindow": "demo-total",
  "allowedMerchantIds": ["merchant_market_data_001"],
  "allowedResourcePatterns": ["GET https://api.example.test/premium/*"],
  "expiresAt": "2026-06-04T00:00:00Z",
  "policyNonce": "policy-nonce-001",
  "createdAt": "2026-06-03T00:00:00Z"
}
```

Rules:

- `status` is one of `active`, `paused`, `expired`, or `revoked`.
- Amount fields are integer strings in motes or the smallest supported unit.
- `spentAmount + authorization.amount` must be less than or equal to `totalBudget`.
- `authorization.amount` must be less than or equal to `maxAmountPerPayment`.
- `allowedResourcePatterns` match `METHOD normalizedUrl`.
- Expired, paused, or revoked policies fail closed.

## Merchant

A `Merchant` defines who can receive payment and which resources they can charge for.

Required fields:

```json
{
  "version": "agentpay-guard-v1",
  "merchantId": "merchant_market_data_001",
  "displayName": "Market Data Merchant",
  "status": "active",
  "casperAccount": "casper-account-hash-or-public-key",
  "settlementAccount": "casper-account-hash-or-public-key",
  "allowedOrigins": ["https://api.example.test"],
  "allowedResourcePatterns": ["GET https://api.example.test/premium/*"],
  "createdAt": "2026-06-03T00:00:00Z"
}
```

Rules:

- `status` is one of `active`, `paused`, or `revoked`.
- The payment destination must match `settlementAccount`.
- The requested resource must match both merchant and policy resource rules.

## PaymentRequirement

A `PaymentRequirement` is returned by a protected resource with HTTP `402 Payment Required`.

Required fields:

```json
{
  "version": "agentpay-guard-v1",
  "requirementId": "req_001",
  "merchantId": "merchant_market_data_001",
  "merchantAccount": "casper-account-hash-or-public-key",
  "method": "GET",
  "url": "https://api.example.test/premium/report?symbol=CSPR",
  "endpointId": "premium-report-cspr",
  "amount": "1000000000",
  "currency": "CSPR",
  "requestHash": "hex-blake2b256",
  "nonce": "merchant-generated-unique-nonce",
  "termsHash": "hex-blake2b256",
  "escrowMode": "authorize_then_settle",
  "expiresAt": "2026-06-03T00:05:00Z",
  "issuedAt": "2026-06-03T00:00:00Z"
}
```

Rules:

- The gateway creates the requirement.
- The requirement expires quickly.
- The requirement must bind to the request via `requestHash`.
- The merchant must not change amount, destination, URL, endpoint, expiry, or nonce after issuing the requirement.

## PaymentAuthorization

A `PaymentAuthorization` is the policy decision allowing one payment.

Required fields:

```json
{
  "version": "agentpay-guard-v1",
  "paymentId": "hex-blake2b256",
  "policyId": "policy_demo_agent_001",
  "agentId": "agent_research_001",
  "merchantId": "merchant_market_data_001",
  "merchantAccount": "casper-account-hash-or-public-key",
  "requirementId": "req_001",
  "endpointId": "premium-report-cspr",
  "requestHash": "hex-blake2b256",
  "amount": "1000000000",
  "currency": "CSPR",
  "nonce": "agent-generated-unique-nonce",
  "expiresAt": "2026-06-03T00:04:00Z",
  "authorizedAt": "2026-06-03T00:00:10Z",
  "signature": "agent-or-owner-signature"
}
```

Rules:

- The policy engine creates the authorization after all checks pass.
- `expiresAt` must be less than or equal to the requirement expiry.
- The authorization is valid for one payment only.
- The authorization must be recorded before a receipt is considered valid.

## PaymentReceipt

A `PaymentReceipt` proves payment or escrow for one request.

Required fields:

```json
{
  "version": "agentpay-guard-v1",
  "paymentId": "hex-blake2b256",
  "policyId": "policy_demo_agent_001",
  "agentId": "agent_research_001",
  "merchantId": "merchant_market_data_001",
  "merchantAccount": "casper-account-hash-or-public-key",
  "endpointId": "premium-report-cspr",
  "requestHash": "hex-blake2b256",
  "amount": "1000000000",
  "currency": "CSPR",
  "status": "escrowed",
  "chainMode": "mock",
  "proof": {
    "kind": "mock",
    "hash": "mock-escrowed-hash",
    "eventId": "mock-escrowed-event-id"
  },
  "casperDeployHash": "optional-backward-compatible-display-hash",
  "casperEventId": "optional-backward-compatible-display-event-id",
  "receiptNonce": "adapter-generated-unique-nonce",
  "issuedAt": "2026-06-03T00:00:20Z",
  "expiresAt": "2026-06-03T00:05:00Z"
}
```

Rules:

- `status` is one of `required`, `authorized`, `submitted`, `escrowed`, `fulfilled`, `settled`, `refunded`, `expired`, `failed`, or `settlement_failed`.
- The receipt must be bound to the same `paymentId` and `requestHash` as the authorization.
- The receipt is accepted by the gateway only while `status` is `escrowed` or `settled`.
- A settled receipt cannot be settled again.
- Mock proofs must be clearly marked by `mock-` hash and event prefixes.

## CasperProof

Internal payment proof uses a proof object instead of assuming Casper legacy deploys:

```ts
type CasperProof =
  | { kind: "mock"; hash: string; eventId: string }
  | { kind: "transaction-v1"; transactionHash: string; eventId?: string }
  | { kind: "legacy-deploy"; deployHash: string; eventId?: string };
```

`casperDeployHash` and `casperEventId` may appear as backward-compatible display fields, but adapter logic must use `proof`.

## requestHash Formula

`requestHash` binds a receipt to one HTTP request.

Formula:

```text
bodyHash = BLAKE2b-256(canonicalJson(request.body))

requestHash = BLAKE2b-256(
  "CSPR_AGENTPAY_REQUEST_V1" + "\n" +
  upper(method) + "\n" +
  normalizeUrl(url) + "\n" +
  bodyHash + "\n" +
  endpointId + "\n" +
  merchantId + "\n" +
  agentId + "\n" +
  nonce + "\n" +
  expiresAtUtc
)
```

For an empty body, `canonicalJson(request.body)` is `{}`.

## paymentId Formula

`paymentId` identifies one authorized payment and prevents duplicate settlement.

Formula:

```text
paymentId = BLAKE2b-256(
  "CSPR_AGENTPAY_PAYMENT_V1" + "\n" +
  policyId + "\n" +
  merchantAccount + "\n" +
  amount + "\n" +
  endpointId + "\n" +
  requestHash + "\n" +
  nonce
)
```

Rules:

- Request nonces must be unique per merchant-issued requirement.
- Payment nonces must be unique per agent authorization.
- The same `paymentId` cannot be authorized, escrowed, or settled twice.

## PolicyDecision

The pure policy engine returns a `PolicyDecision`.

Allowed:

```json
{
  "allowed": true,
  "policyId": "policy_demo_agent_001",
  "merchantId": "merchant_market_data_001",
  "remainingBudget": "9000000000",
  "checkedAt": "2026-06-03T00:00:10Z"
}
```

Denied:

```json
{
  "allowed": false,
  "reason": "MERCHANT_NOT_ALLOWED",
  "policyId": "policy_demo_agent_001",
  "merchantId": "merchant_unknown",
  "remainingBudget": "9000000000",
  "checkedAt": "2026-06-03T00:00:10Z",
  "message": "Merchant is not on the policy allowlist."
}
```

Policy denial reasons are:

- `POLICY_NOT_FOUND`
- `POLICY_INACTIVE`
- `MERCHANT_NOT_ALLOWED`
- `MERCHANT_INACTIVE`
- `MERCHANT_DESTINATION_MISMATCH`
- `RESOURCE_NOT_ALLOWED`
- `CURRENCY_MISMATCH`
- `AMOUNT_EXCEEDS_PAYMENT_LIMIT`
- `BUDGET_EXCEEDED`
- `REQUIREMENT_EXPIRED`
- `REQUEST_HASH_MISMATCH`

## AuditEvent

The mock adapter and future Casper adapter expose an ordered audit timeline. Events include:

```json
{
  "eventId": "mock-event-...",
  "type": "payment_escrowed",
  "createdAt": "2026-06-03T00:00:20Z",
  "policyId": "policy_demo_agent_001",
  "merchantId": "merchant_market_data_001",
  "paymentId": "hex-blake2b256",
  "status": "escrowed",
  "proof": {
    "kind": "mock",
    "hash": "mock-escrowed-...",
    "eventId": "mock-escrowed-event-..."
  },
  "message": "Payment hex-blake2b256 escrowed."
}
```

## State Transitions

Payment state machine:

```text
none
  -> required
  -> authorized
  -> submitted
  -> escrowed
  -> fulfilled
  -> settled
```

Failure and terminal transitions:

```text
required -> expired
authorized -> expired
submitted -> failed
escrowed -> refunded
escrowed -> expired
fulfilled -> settlement_failed
settled -> terminal
refunded -> terminal
expired -> terminal
failed -> terminal
settlement_failed -> terminal
```

Transition rules:

- `required`: Gateway issued a `PaymentRequirement`.
- `authorized`: Policy engine approved a `PaymentAuthorization`.
- `submitted`: Casper adapter submitted a deploy or mock event.
- `escrowed`: Casper event confirms funds are locked or mock adapter confirms escrow.
- `fulfilled`: Gateway accepted receipt and returned protected data.
- `settled`: Merchant settlement completed.
- `refunded`: Escrow returned to owner or agent account.
- `expired`: Requirement, authorization, or receipt expired before completion.
- `failed`: Payment submission or verification failed.
- `settlement_failed`: Merchant attempted settlement, but validation or Casper submission failed.

Invalid transitions must fail closed and emit audit events.

## Error Cases

Protocol errors:

- `POLICY_NOT_FOUND`: Policy ID is unknown.
- `POLICY_INACTIVE`: Policy is paused, expired, or revoked.
- `MERCHANT_NOT_ALLOWED`: Merchant is not on the policy allowlist.
- `MERCHANT_INACTIVE`: Merchant is paused or revoked.
- `RESOURCE_NOT_ALLOWED`: Resource does not match policy or merchant patterns.
- `AMOUNT_EXCEEDS_PAYMENT_LIMIT`: Amount exceeds `maxAmountPerPayment`.
- `BUDGET_EXCEEDED`: Amount exceeds remaining budget.
- `CURRENCY_MISMATCH`: Requirement currency differs from policy currency.
- `REQUIREMENT_EXPIRED`: Requirement is past `expiresAt`.
- `AUTHORIZATION_EXPIRED`: Authorization is past `expiresAt`.
- `RECEIPT_EXPIRED`: Receipt is past `expiresAt`.
- `REQUEST_HASH_MISMATCH`: Receipt does not match the current request.
- `PAYMENT_ID_MISMATCH`: Receipt does not match the authorization.
- `REPLAY_DETECTED`: Requirement nonce, authorization nonce, receipt nonce, or payment ID was reused.
- `DUPLICATE_SETTLEMENT`: Payment is already settled.
- `CASPER_SUBMIT_FAILED`: Deploy submission failed.
- `CASPER_EVENT_NOT_FOUND`: Required Casper event cannot be found.
- `CASPER_EVENT_INVALID`: Casper event does not match protocol fields.
- `MOCK_MODE_NOT_ALLOWED`: Real mode was required, but only mock proof exists.
- `MERCHANT_DESTINATION_MISMATCH`: Requirement destination differs from registered merchant settlement account.
- `TERMS_HASH_MISMATCH`: Merchant terms changed after requirement issuance.

HTTP mapping:

- `402`: Payment required or payment proof missing.
- `400`: Malformed protocol object.
- `401`: Missing or invalid agent identity.
- `403`: Policy, merchant, resource, or budget denied.
- `409`: Replay, duplicate settlement, or invalid state transition.
- `410`: Expired requirement, authorization, or receipt.
- `502`: Casper submission or event lookup failed.
