# Casper Contract Boundary

Protocol version: `agentpay-guard-v1`

This document defines the Casper smart contract modules, entrypoints, and events that the TypeScript `CasperPaymentAdapter` interface maps to. It bridges the current mock state machine (`MockCasperPaymentAdapter`) to the future on-chain implementation (`RealCasperTestnetAdapter`).

Contracts are scaffold-only today. The first real target is on-chain event/state proof, not production custody. Payable escrow is a stretch goal.

---

## 1. Intended Casper Modules

Three Odra-based smart contract modules are planned:

### 1.1 AgentPolicyRegistry

**Purpose:** On-chain policy storage and lifecycle management for autonomous agent spending rules.

**Owned state:**

| Field | Type | Description |
|---|---|---|
| `policies` | `Map<PolicyId, AgentPolicy>` | All registered policies keyed by `policyId`. |
| `policy_nonce_set` | `Set<Nonce>` | Used nonces to reject duplicate policy creation. |

**Public entrypoints:**

| Entrypoint | Description | Matching TS adapter method |
|---|---|---|
| `create_policy(policy)` | Store a new agent policy. Rejects duplicate `policyId`. | `createPolicy(input)` |
| `revoke_policy(policy_id)` | Set policy status to `revoked`. Idempotent if already revoked or missing. | `revokePolicy(policyId)` |
| `get_policy(policy_id)` | Return the stored policy or `None`. | `getPolicy(policyId)` |
| `is_policy_active(policy_id)` | Return `true` if policy exists and status is `active` and not expired. | *(called internally by `authorizePayment`)* |

**Emitted events:**

- `PolicyCreated` — when `create_policy` succeeds.
- `PolicyRevoked` — when `revoke_policy` succeeds.

**Failure cases:**

- `create_policy` with an already-registered `policyId` → error.
- `create_policy` with an unsupported `currency` (not `CSPR`) → error.
- `create_policy` with `expiresAt` in the past → error.
- `create_policy` with `totalBudget` less than `spentAmount` → error.
- `get_policy` for an unknown `policyId` → returns `None` (not an error).

**How it maps to MockCasperPaymentAdapter behavior:**

The mock adapter stores policies in a private `Map<string, AgentPolicy>` and validates input through `validateAgentPolicy`. The `PolicyCreated`/`PolicyRevoked` audit events are emitted locally. The real contract would store policies on-chain and emit CES events.

---

### 1.2 MerchantRegistry

**Purpose:** On-chain merchant registration and identity binding.

**Owned state:**

| Field | Type | Description |
|---|---|---|
| `merchants` | `Map<MerchantId, Merchant>` | All registered merchants keyed by `merchantId`. |

**Public entrypoints:**

| Entrypoint | Description | Matching TS adapter method |
|---|---|---|
| `register_merchant(merchant)` | Store a new merchant. Rejects duplicate `merchantId`. | `registerMerchant(input)` |
| `get_merchant(merchant_id)` | Return the stored merchant or `None`. | `getMerchant(merchantId)` |
| `is_merchant_active(merchant_id)` | Return `true` if merchant exists and status is `active`. | *(called internally by `authorizePayment`)* |

**Emitted events:**

- `MerchantRegistered` — when `register_merchant` succeeds.

**Failure cases:**

- `register_merchant` with an already-registered `merchantId` → error.
- `register_merchant` with an invalid Casper account hash format → error.
- `get_merchant` for an unknown `merchantId` → returns `None` (not an error).

**How it maps to MockCasperPaymentAdapter behavior:**

The mock adapter stores merchants in a private `Map<string, Merchant>` and validates input through `validateMerchant`. The `MerchantRegistered` audit event is emitted locally.

---

### 1.3 PaymentEscrow

**Purpose:** Payment lifecycle management with escrow, fulfillment, settlement, expiry, and replay protection.

**Owned state:**

| Field | Type | Description |
|---|---|---|
| `payments` | `Map<PaymentId, PaymentReceipt>` | All payments keyed by deterministic `paymentId`. |
| `used_requirement_nonces` | `Set<Nonce>` | Requirement nonces that have been consumed. |
| `used_authorization_nonces` | `Set<Nonce>` | Authorization nonces that have been consumed. |
| `used_receipt_nonces` | `Set<Nonce>` | Receipt nonces that have been consumed. |
| `used_payment_ids` | `Set<PaymentId>` | Payment IDs that have been authorized. |

**Public entrypoints:**

| Entrypoint | Description | Matching TS adapter method |
|---|---|---|
| `authorize_payment(input)` | Validate policy, merchant, budget, and nonces. Create authorization + receipt. Emit `PaymentAuthorized` or `PaymentRejected`. | `authorizePayment(input)` |
| `submit_payment(payment_id)` | Transition from `authorized` to `submitted` to `escrowed`. Emit `PaymentSubmitted` then `PaymentEscrowed`. | `submitPayment(input)` |
| `mark_fulfilled(payment_id)` | Transition from `escrowed` to `fulfilled`. Record optional `responseHash`. Emit `PaymentFulfilled`. | `markFulfilled(input)` |
| `settle_payment(payment_id)` | Transition from `fulfilled` to `settled`. Reject if already settled. Emit `PaymentSettled` or `DuplicateSettlementRejected`. | `settlePayment(input)` |
| `expire_payment(payment_id)` | Transition from non-terminal state to `expired`. Emit `PaymentExpired`. | `expirePayment(paymentId)` |
| `get_payment(payment_id)` | Return the stored payment receipt or `None`. | `getPayment(paymentId)` |

**Emitted events:**

- `PaymentAuthorized` — policy check passed, authorization created.
- `PaymentRejected` — policy check failed (reason included).
- `PaymentSubmitted` — payment submitted to Casper.
- `PaymentEscrowed` — funds locked or escrow confirmed.
- `PaymentFulfilled` — gateway accepted receipt, premium data released.
- `PaymentSettled` — merchant settlement completed.
- `PaymentExpired` — payment expired before terminal state.
- `ReplayRejected` — nonce or payment ID was reused.

**Failure cases:**

- `authorize_payment` with an unknown or inactive policy → `PaymentRejected` with reason.
- `authorize_payment` with a merchant not on the policy allowlist → `PaymentRejected`.
- `authorize_payment` with an over-budget amount → `PaymentRejected`.
- `authorize_payment` with an expired requirement → `PaymentRejected`.
- `authorize_payment` with a reused nonce → `ReplayRejected`.
- `authorize_payment` with a duplicate `paymentId` → `ReplayRejected`.
- `submit_payment` when payment is not in `authorized` state → `INVALID_STATE_TRANSITION`.
- `mark_fulfilled` when payment is not in `escrowed` state → `INVALID_STATE_TRANSITION`.
- `settle_payment` when payment is not in `fulfilled` state → `INVALID_STATE_TRANSITION`.
- `settle_payment` when payment is already `settled` → `DUPLICATE_SETTLEMENT`.
- `expire_payment` when payment is in a terminal state → `INVALID_STATE_TRANSITION`.

**How it maps to MockCasperPaymentAdapter behavior:**

The mock adapter implements the full state machine locally. It stores payments, nonces, and payment IDs in private Maps and Sets. State transitions are enforced: `authorized → submitted → escrowed → fulfilled → settled`. Replay detection checks requirement nonces, authorization nonces, receipt nonces, and payment IDs before any state change. Audit events are emitted at each transition. The real contract would store this state on-chain and enforce the same transitions through entrypoint logic.

---

## 2. Contract Entrypoints (Detailed)

### 2.1 `create_policy`

**Module:** AgentPolicyRegistry

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `policy_id` | `String` | `AgentPolicy.policyId` |
| `owner_account` | `AccountHash` | `AgentPolicy.ownerAccount` |
| `agent_id` | `String` | `AgentPolicy.agentId` |
| `currency` | `String` | `AgentPolicy.currency` (`"CSPR"`) |
| `max_amount_per_payment` | `U512` | `AgentPolicy.maxAmountPerPayment` |
| `total_budget` | `U512` | `AgentPolicy.totalBudget` |
| `spent_amount` | `U512` | `AgentPolicy.spentAmount` |
| `budget_window` | `String` | `AgentPolicy.budgetWindow` |
| `allowed_merchant_ids` | `Vec<String>` | `AgentPolicy.allowedMerchantIds` |
| `allowed_resource_patterns` | `Vec<String>` | `AgentPolicy.allowedResourcePatterns` |
| `expires_at` | `u64` (Unix ms) | `AgentPolicy.expiresAt` |
| `policy_nonce` | `String` | `AgentPolicy.policyNonce` |
| `created_at` | `u64` (Unix ms) | `AgentPolicy.createdAt` |

**Output/result:** Stored `AgentPolicy` record.

**Required checks:**

- `policy_id` is not already registered.
- `currency` is `"CSPR"`.
- `expires_at` is in the future.
- `total_budget` >= `spent_amount`.
- All amount fields are valid non-negative integers.

**Emitted event:** `PolicyCreated`

**Matching protocol types:** `AgentPolicy`

**Matching adapter method:** `CasperPaymentAdapter.createPolicy(input)`

---

### 2.2 `revoke_policy`

**Module:** AgentPolicyRegistry

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `policy_id` | `String` | `AgentPolicy.policyId` |

**Output/result:** Transaction result confirming revocation.

**Required checks:**

- Idempotent: succeeds even if policy is already revoked or does not exist.

**Emitted event:** `PolicyRevoked`

**Matching protocol types:** Uses `policyId` identifier.

**Matching adapter method:** `CasperPaymentAdapter.revokePolicy(policyId)`

---

### 2.3 `register_merchant`

**Module:** MerchantRegistry

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `merchant_id` | `String` | `Merchant.merchantId` |
| `display_name` | `String` | `Merchant.displayName` |
| `casper_account` | `AccountHash` | `Merchant.casperAccount` |
| `settlement_account` | `AccountHash` | `Merchant.settlementAccount` |
| `allowed_origins` | `Vec<String>` | `Merchant.allowedOrigins` |
| `allowed_resource_patterns` | `Vec<String>` | `Merchant.allowedResourcePatterns` |
| `created_at` | `u64` (Unix ms) | `Merchant.createdAt` |

**Output/result:** Stored `Merchant` record.

**Required checks:**

- `merchant_id` is not already registered.
- `casper_account` and `settlement_account` have valid AccountHash format.

**Emitted event:** `MerchantRegistered`

**Matching protocol types:** `Merchant`

**Matching adapter method:** `CasperPaymentAdapter.registerMerchant(input)`

---

### 2.4 `authorize_payment`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `policy_id` | `String` | `AuthorizePaymentInput.policyId` |
| `requirement` | `PaymentRequirement` | `AuthorizePaymentInput.requirement` |
| `expected_request_hash` | `Option<String>` | `AuthorizePaymentInput.expectedRequestHash` |
| `authorization_nonce` | `String` | `AuthorizePaymentInput.authorizationNonce` |
| `receipt_nonce` | `String` | `AuthorizePaymentInput.receiptNonce` |

**Output/result:** `PaymentAuthorizationResult` containing authorization, decision, receipt, proof, and updated policy.

**Required checks:**

- Policy exists, is active, and is not expired.
- Merchant exists and is active.
- Merchant is on the policy allowlist.
- Requirement destination matches merchant settlement account.
- Resource pattern matches policy and merchant scopes.
- Currency matches policy currency.
- Amount does not exceed `maxAmountPerPayment`.
- `spentAmount + amount` does not exceed `totalBudget`.
- Requirement has not expired.
- `requestHash` is valid and matches the expected hash.
- Requirement nonce has not been used.
- Authorization nonce has not been used.
- Receipt nonce has not been used.
- `paymentId` has not been used.

**Emitted event:** `PaymentAuthorized` (on success) or `PaymentRejected` (on failure).

**Matching protocol types:** `PaymentAuthorization`, `PaymentReceipt`, `PolicyDecision`, `AgentPolicy`

**Matching adapter method:** `CasperPaymentAdapter.authorizePayment(input)`

---

### 2.5 `submit_payment`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `payment_id` | `String` | `SubmitPaymentInput.paymentId` |

**Output/result:** Updated `PaymentReceipt` with status `escrowed`.

**Required checks:**

- Payment exists and is in `authorized` state.
- Transitions through `submitted` → `escrowed`.

**Emitted events:** `PaymentSubmitted`, then `PaymentEscrowed` (two transitions in one call).

**Matching protocol types:** `PaymentReceipt`

**Matching adapter method:** `CasperPaymentAdapter.submitPayment(input)`

---

### 2.6 `mark_fulfilled`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `payment_id` | `String` | `MarkFulfilledInput.paymentId` |
| `response_hash` | `Option<String>` | `MarkFulfilledInput.responseHash` |

**Output/result:** Updated `PaymentReceipt` with status `fulfilled` and optional `responseHash`.

**Required checks:**

- Payment exists and is in `escrowed` state.

**Emitted event:** `PaymentFulfilled`

**Matching protocol types:** `PaymentReceipt`

**Matching adapter method:** `CasperPaymentAdapter.markFulfilled(input)`

---

### 2.7 `settle_payment`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `payment_id` | `String` | `SettlePaymentInput.paymentId` |

**Output/result:** `SettlementResult` with status `settled` and proof.

**Required checks:**

- Payment exists and is in `fulfilled` state.
- Payment is not already `settled`.

**Emitted event:** `PaymentSettled` (on success) or `DuplicateSettlementRejected` (on duplicate).

**Matching protocol types:** `PaymentReceipt`, `SettlementResult`

**Matching adapter method:** `CasperPaymentAdapter.settlePayment(input)`

---

### 2.8 `expire_payment`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `payment_id` | `String` | *(payment ID only)* |

**Output/result:** Transaction result confirming expiry.

**Required checks:**

- Payment exists and is in a non-terminal state (`authorized`, `submitted`, `escrowed`, or `fulfilled`).

**Emitted event:** `PaymentExpired`

**Matching protocol types:** `PaymentReceipt`

**Matching adapter method:** `CasperPaymentAdapter.expirePayment(paymentId)`

---

### 2.9 `get_policy`

**Module:** AgentPolicyRegistry

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `policy_id` | `String` | `AgentPolicy.policyId` |

**Output/result:** `Option<AgentPolicy>` — the stored policy or `None`.

**Required checks:** None (read-only).

**Emitted event:** None.

**Matching protocol types:** `AgentPolicy`

**Matching adapter method:** `CasperPaymentAdapter.getPolicy(policyId)`

---

### 2.10 `get_merchant`

**Module:** MerchantRegistry

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `merchant_id` | `String` | `Merchant.merchantId` |

**Output/result:** `Option<Merchant>` — the stored merchant or `None`.

**Required checks:** None (read-only).

**Emitted event:** None.

**Matching protocol types:** `Merchant`

**Matching adapter method:** `CasperPaymentAdapter.getMerchant(merchantId)`

---

### 2.11 `get_payment`

**Module:** PaymentEscrow

**Input fields:**

| Field | Type | Protocol type |
|---|---|---|
| `payment_id` | `String` | `PaymentReceipt.paymentId` |

**Output/result:** `Option<PaymentReceipt>` — the stored payment receipt or `None`.

**Required checks:** None (read-only).

**Emitted event:** None.

**Matching protocol types:** `PaymentReceipt`

**Matching adapter method:** `CasperPaymentAdapter.getPayment(paymentId)`

---

## 3. Casper Event Schema

All events conform to the Casper Event Standard (CES). Each event maps to the TypeScript `AuditEvent` model defined in `packages/protocol/src/types.ts`.

### Common event fields

Every event includes:

| Field | Type | Description |
|---|---|---|
| `event_id` | `String` | Unique event identifier. Real events use a Casper-derived ID; mock events use `mock-event-*` prefix. |
| `timestamp` | `u64` (Unix ms) | When the event was emitted. ISO 8601 string in TypeScript. |
| `actor` | `String` | The caller's account hash or public key (the agent, merchant, or owner who triggered the action). |

### 3.1 `PolicyCreated`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The `policyId` of the created policy. |

**TypeScript audit event type:** `policy_created`

**When emitted:** After `create_policy` succeeds.

---

### 3.2 `PolicyRevoked`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The `policyId` of the revoked policy. |

**TypeScript audit event type:** `policy_revoked`

**When emitted:** After `revoke_policy` succeeds.

---

### 3.3 `MerchantRegistered`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `merchant_id` | `String` | Yes | The `merchantId` of the registered merchant. |

**TypeScript audit event type:** `merchant_registered`

**When emitted:** After `register_merchant` succeeds.

---

### 3.4 `PaymentAuthorized`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that authorized the payment. |
| `merchant_id` | `String` | Yes | The merchant receiving payment. |
| `payment_id` | `String` | Yes | The deterministic `paymentId`. |
| `status` | `String` | Yes | `"authorized"`. |
| `proof` | `CasperProof` (JSON) | Yes | The proof object (`transaction-v1` or `legacy-deploy` when real; `mock` when simulated). |

**TypeScript audit event type:** `payment_authorized`

**When emitted:** After `authorize_payment` passes all policy checks.

---

### 3.5 `PaymentSubmitted`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that authorized the payment. |
| `merchant_id` | `String` | Yes | The merchant receiving payment. |
| `payment_id` | `String` | Yes | The deterministic `paymentId`. |
| `status` | `String` | Yes | `"submitted"`. |
| `proof` | `CasperProof` (JSON) | Yes | The transaction proof from Casper. |

**TypeScript audit event type:** `payment_submitted`

**When emitted:** After Casper accepts the deploy/transaction.

---

### 3.6 `PaymentEscrowed`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that authorized the payment. |
| `merchant_id` | `String` | Yes | The merchant receiving payment. |
| `payment_id` | `String` | Yes | The deterministic `paymentId`. |
| `status` | `String` | Yes | `"escrowed"`. |
| `proof` | `CasperProof` (JSON) | Yes | The Casper event proof confirming escrow. |

**TypeScript audit event type:** `payment_escrowed`

**When emitted:** After Casper event confirms escrow (mock mode transitions immediately after submit).

---

### 3.7 `PaymentFulfilled`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that authorized the payment. |
| `merchant_id` | `String` | Yes | The merchant receiving payment. |
| `payment_id` | `String` | Yes | The deterministic `paymentId`. |
| `status` | `String` | Yes | `"fulfilled"`. |
| `proof` | `CasperProof` (JSON) | Yes | The proof from the fulfillment event. |

**TypeScript audit event type:** `payment_fulfilled`

**When emitted:** After gateway verifies receipt and releases premium data.

---

### 3.8 `PaymentSettled`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that authorized the payment. |
| `merchant_id` | `String` | Yes | The merchant receiving settlement. |
| `payment_id` | `String` | Yes | The deterministic `paymentId`. |
| `status` | `String` | Yes | `"settled"`. |
| `proof` | `CasperProof` (JSON) | Yes | The transaction proof from settlement. |

**TypeScript audit event type:** `payment_settled`

**When emitted:** After settlement completes.

---

### 3.9 `PaymentExpired`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | No | The policy ID if available. |
| `merchant_id` | `String` | No | The merchant ID if available. |
| `payment_id` | `String` | Yes | The expired `paymentId`. |
| `status` | `String` | Yes | `"expired"`. |

**TypeScript audit event type:** `payment_expired`

**When emitted:** After `expire_payment` succeeds or when a requirement/authorization/receipt passes its `expiresAt`.

---

### 3.10 `PaymentRejected`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | Yes | The policy that was checked. |
| `merchant_id` | `String` | Yes | The merchant that was checked. |
| `reason` | `PolicyDenialReason` | Yes | The denial reason code (e.g., `MERCHANT_NOT_ALLOWED`, `BUDGET_EXCEEDED`). |
| `message` | `String` | Yes | Human-readable explanation. |

**TypeScript audit event type:** `payment_denied`

**When emitted:** When `authorize_payment` fails a policy check. The `reason` field uses one of the `PolicyDenialReason` values.

---

### 3.11 `ReplayRejected`

| Additional field | Type | Required | Description |
|---|---|---|---|
| `policy_id` | `String` | No | The policy ID if available. |
| `merchant_id` | `String` | No | The merchant ID if available. |
| `payment_id` | `String` | No | The payment ID involved in the replay attempt. |
| `reason` | `"REPLAY_DETECTED"` | Yes | Always `REPLAY_DETECTED`. |
| `message` | `String` | Yes | Describes which nonce or ID was reused. |

**TypeScript audit event type:** `replay_rejected`

**When emitted:** When a requirement nonce, authorization nonce, receipt nonce, or payment ID is reused.

---

## 4. Proof Convention: Real vs Mock

### 4.1 Mock proofs

All proofs from `MockCasperPaymentAdapter` use:

```json
{
  "kind": "mock",
  "hash": "mock-<kind>-<32-hex-chars>",
  "eventId": "mock-<kind>-event-<32-hex-chars>"
}
```

Mock proofs are **never** presented as real Casper settlement. The dashboard and audit trail must visibly label mock mode.

### 4.2 Real Casper proofs

The `RealCasperTestnetAdapter` must only produce:

```json
{
  "kind": "transaction-v1",
  "transactionHash": "<64-char-hex-transaction-hash>",
  "eventId": "<optional-CES-event-id>"
}
```

or, for legacy deploys:

```json
{
  "kind": "legacy-deploy",
  "deployHash": "<64-char-hex-deploy-hash>",
  "eventId": "<optional-CES-event-id>"
}
```

The real adapter must **never** produce `kind: "mock"` proofs. The `CasperProofSchema` in `packages/protocol/src/validation.ts` enforces this at the type level: the `transaction-v1` and `legacy-deploy` schemas require `nonEmptyString` for their hash fields (no `mock-` prefix).

### 4.3 Backward-compatible display fields

`PaymentReceipt.casperDeployHash` and `PaymentReceipt.casperEventId` are optional display compatibility fields. The adapter must derive them from `proof`:

| Proof kind | `casperDeployHash` value |
|---|---|
| `mock` | `proof.hash` |
| `transaction-v1` | `proof.transactionHash` |
| `legacy-deploy` | `proof.deployHash` |

---

## 5. Real Adapter to Contract Mapping

When the `RealCasperTestnetAdapter` is implemented, each adapter method maps to contract calls:

| Adapter method | Contract module | Contract entrypoint | Casper operation |
|---|---|---|---|
| `createPolicy` | `AgentPolicyRegistry` | `create_policy` | Contract call (transaction-v1) |
| `revokePolicy` | `AgentPolicyRegistry` | `revoke_policy` | Contract call (transaction-v1) |
| `registerMerchant` | `MerchantRegistry` | `register_merchant` | Contract call (transaction-v1) |
| `authorizePayment` | `PaymentEscrow` | `authorize_payment` | Contract call (transaction-v1) |
| `submitPayment` | `PaymentEscrow` | `submit_payment` | Contract call (transaction-v1) |
| `markFulfilled` | `PaymentEscrow` | `mark_fulfilled` | Contract call (transaction-v1) |
| `settlePayment` | `PaymentEscrow` | `settle_payment` | Contract call (transaction-v1) |
| `expirePayment` | `PaymentEscrow` | `expire_payment` | Contract call (transaction-v1) |
| `getPolicy` | `AgentPolicyRegistry` | `get_policy` | RPC query (read-only) |
| `getMerchant` | `MerchantRegistry` | `get_merchant` | RPC query (read-only) |
| `getPayment` | `PaymentEscrow` | `get_payment` | RPC query (read-only) |
| `listPayments` | `PaymentEscrow` | *(CSPR.cloud index)* | CSPR.cloud event stream |
| `listAuditEvents` | *(multiple)* | *(CSPR.cloud index)* | CSPR.cloud contract-level events |

---

## 6. State Transition Consistency

The contract state machine must match the mock adapter exactly:

```text
none → required → authorized → submitted → escrowed → fulfilled → settled
                                                                    ↓
                                                                 terminal
```

Failure paths:

```text
required → expired
authorized → expired
submitted → failed
escrowed → refunded / expired
fulfilled → settlement_failed
```

Invalid transitions must fail closed on-chain (revert the call) and emit an error event that the adapter can surface.

---

## 7. Environment Variables for Contract Integration

The real adapter requires these environment variables before any contract call:

| Variable | Used by | Description |
|---|---|---|
| `CASPER_TESTNET_PUBLIC_KEY` | Adapter | Agent/owner public key for signing. |
| `CASPER_TESTNET_SECRET_KEY_PATH` | Adapter | Path to PEM secret key file. |
| `CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH` | Adapter | Deployed contract package hash. |
| `CASPER_AGENTPAY_CONTRACT_HASH` | Adapter | Deployed contract hash. |
| `POLICY_REGISTRY_HASH` | Adapter | `AgentPolicyRegistry` contract hash (if separate). |
| `MERCHANT_REGISTRY_HASH` | Adapter | `MerchantRegistry` contract hash (if separate). |
| `PAYMENT_ESCROW_HASH` | Adapter | `PaymentEscrow` contract hash (if separate). |
| `CASPER_RPC_URL` | Adapter | Casper Testnet RPC endpoint. |
| `CASPER_NODE_SSE_URL` | Adapter | Casper SSE endpoint for event streaming. |
| `CSPR_CLOUD_AUTH_TOKEN` | Adapter | CSPR.cloud authorization token. |
| `CSPR_CLOUD_API_URL` | Adapter | CSPR.cloud REST API base URL. |
| `CSPR_CLOUD_STREAM_URL` | Adapter | CSPR.cloud WebSocket stream URL. |

The `RealCasperTestnetAdapter.getMissingEnvVars(env)` static method reports which of the required variables are not set, without throwing.

---

## 8. Current Status

- **Contracts (`contracts/agentpay-guard`):** Scaffold only. A minimal Odra module with `init()` and `is_initialized()`. No production escrow, policy, or payment logic exists yet.
- **Real adapter (`RealCasperTestnetAdapter`):** Skeleton that satisfies the `CasperPaymentAdapter` interface. Every method throws a clear "not implemented yet" error with guidance to use mock mode.
- **Mock adapter (`MockCasperPaymentAdapter`):** Fully functional local payment state machine that implements the identical interface with deterministic mock proofs.
- **Next step:** Prompt 6 — build `apps/paid-api` HTTP 402 protected-resource flow on top of the mock adapter. Real contract deployment follows after the HTTP 402 flow is proven.
