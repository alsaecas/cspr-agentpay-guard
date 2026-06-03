# Threat Model

## Security Goal

CSPR AgentPay Guard should let an autonomous agent pay for one protected resource only when a policy allows it, with a receipt that cannot be reused, redirected, inflated, or settled twice.

## Replay Attacks

Threat:

An attacker reuses a valid authorization or receipt to access the same paid resource multiple times or trigger another settlement.

Controls:

- `paymentId` is unique and recorded.
- Requirement, authorization, and receipt nonces are tracked.
- Receipt status is checked before fulfillment and settlement.
- Gateway rejects already-used payment IDs when the resource is single-use.
- Contract or adapter rejects duplicate settlement.

MVP evidence:

- Audit trail shows first receipt accepted and replay attempt rejected with `REPLAY_DETECTED` or `DUPLICATE_SETTLEMENT`.

## Reused Receipts On Different URLs

Threat:

A receipt for one URL is submitted for another URL, query, method, body, resource, merchant, or agent.

Controls:

- Receipt includes `requestHash`.
- `requestHash` binds method, normalized URL, resource ID, merchant ID, agent ID, body hash, and selected headers hash.
- Gateway recomputes `requestHash` on every protected request.
- Any mismatch fails closed with `REQUEST_HASH_MISMATCH`.

MVP evidence:

- Test covers changing URL query parameters after payment.

## Duplicate Settlement

Threat:

A merchant settles the same escrowed payment more than once.

Controls:

- Payment state allows `settled` only once.
- `paymentId` is the settlement key.
- Casper contract or adapter stores terminal settlement state.
- Gateway and dashboard treat duplicate settlement as a `409` state conflict.

MVP evidence:

- Dashboard shows one successful settlement and one rejected duplicate settlement attempt.

## Malicious Merchant

Threat:

A merchant overcharges, changes the destination account, changes terms, issues misleading requirements, or tries to settle without fulfilling the resource.

Controls:

- Merchant must be allowlisted in policy.
- Merchant settlement account must match registry.
- Amount must pass policy limits.
- Requirement includes `termsHash`, `amount`, `currency`, `resourceId`, `requestHash`, and expiry.
- Authorization is bound to the original requirement.
- Dashboard shows merchant, amount, destination, terms hash, and final state.
- Escrow mode allows withholding settlement if fulfillment is not recorded.

MVP evidence:

- Test rejects destination mismatch.
- Demo shows merchant allowlist and exact amount before authorization.

## Overspending Agent

Threat:

An autonomous agent loops, follows prompt injection, or calls expensive tools until it drains the budget.

Controls:

- Per-payment maximum.
- Total or rolling budget.
- Merchant allowlist.
- Resource pattern allowlist.
- Expiring policy.
- Policy engine authorizes every payment independently.
- Budget is reserved or spent when authorization/payment occurs, not after frontend display.

MVP evidence:

- Demo policy has a small visible budget.
- Test rejects a payment that exceeds remaining budget.

## Expired Payment

Threat:

An old requirement, authorization, or receipt is used after the user expected it to be invalid.

Controls:

- Requirement, authorization, receipt, and policy all have `expiresAt`.
- Expired objects fail closed.
- Gateway and policy engine use server-side time.
- Casper event time or block time is included where available.

MVP evidence:

- Test rejects expired requirements and receipts.

## Response Tampering

Threat:

An attacker modifies the premium response after payment or tricks the dashboard into showing unearned fulfillment.

Controls:

- Gateway records fulfillment only after receipt verification.
- Merchant response can include a response hash in stretch mode.
- Dashboard reads backend audit events, not frontend claims.
- Real mode should link fulfillment to payment event IDs.

MVP evidence:

- Dashboard event order shows receipt verified before premium response.

## Frontend Spoofing

Threat:

The UI displays fake policy approval, fake Casper transaction hashes, or fake settlement.

Controls:

- Frontend is display-only for protocol truth.
- Backend audit log is authoritative for mock mode.
- Casper event lookup is authoritative for real mode.
- Mock deploy hashes and real deploy hashes are visually distinct.
- UI labels mode as `mock` or `real Casper Testnet`.

MVP evidence:

- Dashboard cannot mark a payment settled without backend or Casper event state.

## Mock Mode Vs Real Mode Risks

Threat:

Judges or developers confuse a simulated payment for real Casper Testnet activity.

Controls:

- Mock mode uses `mock-deploy-` and `mock-event-` prefixes.
- Mock mode is clearly labeled in the dashboard.
- Real mode requires Casper Testnet deploy hash and event lookup.
- Protocol objects stay identical across modes.
- Demo script should explicitly say when switching from local mock reliability to real Casper proof.

MVP evidence:

- Dashboard includes a mode indicator on every payment.
- Judging demo includes at least one visible Casper Testnet transaction/event path when real mode is ready.

## Residual Risks

Known risks acceptable for MVP:

- Custody is demo-grade until real wallet and contract integration are hardened.
- Merchant identity is registry-based and not production KYC.
- Disputes are simplified to escrow, settlement, refund, and audit events.
- MCP tools are optional and should not bypass the gateway or policy engine.

