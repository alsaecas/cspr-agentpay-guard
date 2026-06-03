# CSPR AgentPay Guard Operating Rules

## Repo Mission

CSPR AgentPay Guard is a policy-controlled payment firewall for autonomous AI agents. The project proves that Casper can power safe machine-to-machine commerce: an AI agent autonomously pays for protected APIs, data, compute, or other agents through HTTP 402-style flows while Casper records enforceable policy decisions, receipts, escrow, settlement, and audit trails.

This is a Casper Agentic Buildathon project. Optimize every implementation choice for a crisp demo that shows:

1. An agent requests a protected resource.
2. The resource server returns a payment requirement.
3. The agent evaluates a policy and authorizes payment without human approval.
4. Casper Testnet records the payment or escrow event.
5. The resource server verifies the receipt and returns premium data.
6. The dashboard shows the policy decision, Casper transaction, and audit path.

## Architecture

Expected MVP components:

- `agent`: Demo autonomous agent that calls a paid endpoint, receives `402 Payment Required`, evaluates policy, submits or simulates payment, retries with a receipt, and consumes the premium response.
- `gateway`: HTTP 402 payment firewall in front of protected resources. It creates `PaymentRequirement` objects, verifies receipts, blocks invalid payment attempts, and emits audit events.
- `policy engine`: Deterministic decision layer that checks merchant allowlists, resource binding, per-request limits, rolling budgets, expiry, nonces, and replay status before authorizing payment.
- `Casper payment layer`: Mock-first adapter with the same interface as the real Casper Testnet adapter. The real adapter should submit deploys, read events, and expose transaction links.
- `merchant API`: Demo paid API that returns premium data only after a verified request-bound receipt.
- `dashboard`: Visible audit trail for judges. It should show policy, 402 requirement, authorization, Casper deploy or mock event, receipt verification, protected response, settlement, and final state.
- `smart contracts`: Odra-based Casper contracts for policies, payments, escrow, settlement, receipt status, replay protection, and events when real mode is implemented.
- `MCP tools`: Optional agent-facing tools that let an AI agent discover protected resources, request payment requirements, authorize payments, and fetch paid data.

Preferred boundaries:

- The gateway owns HTTP protocol behavior.
- The policy engine owns authorization logic.
- The Casper adapter owns chain writes, chain reads, deploy hashes, and event mapping.
- The dashboard reads from an audit/event store instead of inventing state.
- The mock adapter must be API-compatible with the real adapter.

## Mock-First, Real-Casper-Second Strategy

Build in two phases:

1. Mock mode first:
   - Implement the full end-to-end user journey without waiting on chain integration.
   - Use deterministic mock deploy hashes and mock Casper events.
   - Preserve the exact protocol objects and adapter interfaces expected by real mode.
   - Make mock mode visually obvious in the UI and audit records.

2. Real Casper Testnet second:
   - Replace the mock adapter with Casper Testnet deploy submission and event lookup.
   - Keep the gateway, policy engine, agent, and dashboard contracts stable.
   - Link every real payment or settlement to a visible Casper Testnet transaction.
   - Prefer the simplest reliable on-chain proof over a broad unfinished contract surface.

Do not let mock mode become a separate product. It is a deterministic simulator for the same protocol.

## Coding Conventions

- Keep protocol types explicit and versioned.
- Use deterministic serialization for hashes and IDs.
- Keep policy checks pure where possible.
- Keep side effects at adapter boundaries.
- Prefer small modules with obvious ownership over broad utility files.
- Do not add blockchain, wallet, AI, or payment abstractions unless they are used by the demo path.
- Make demo state resettable.
- Make errors judge-readable in logs and dashboard events.
- Use clear names from the protocol spec: `AgentPolicy`, `Merchant`, `PaymentRequirement`, `PaymentAuthorization`, `PaymentReceipt`, `requestHash`, and `paymentId`.
- Treat all money amounts as integer minor units or integer motes. Never use floating point for balances, limits, or settlement.
- Store timestamps as ISO 8601 strings in API objects and Unix milliseconds internally only when needed.

## Testing Requirements

Every future implementation task should include tests proportional to risk.

Minimum MVP tests:

- Policy allows an approved merchant within per-payment and total budget.
- Policy rejects unknown merchants.
- Policy rejects resources outside the policy scope.
- Policy rejects expired requirements.
- Policy rejects over-budget payments.
- Gateway rejects receipts with mismatched `requestHash`.
- Gateway rejects reused receipts for a different URL, method, or body.
- Gateway rejects duplicate settlement.
- Mock Casper adapter emits deterministic payment and settlement events.
- Real Casper adapter tests may be integration-gated, but its interface must match mock mode.

For UI work:

- Verify the demo flow in a browser.
- Check that mock mode and real mode are visibly distinct.
- Check that Casper transaction links are shown when real mode is active.

## Security Invariants

These invariants must not be weakened:

- A receipt is valid only for the exact request represented by `requestHash`.
- A payment can be settled at most once.
- A payment authorization must be bound to one policy, one agent, one merchant, one requirement, and one request hash.
- A policy must enforce merchant allowlists before payment authorization.
- A policy must enforce per-payment limits and rolling or total budget limits before payment authorization.
- Expired policies, requirements, authorizations, and receipts must fail closed.
- Replay protection must be enforced by `paymentId`, requirement nonce, and receipt status.
- Merchants must not be able to increase amount, change resource, change destination account, or extend expiry after the agent signs or authorizes payment.
- Dashboard state must be derived from backend audit records and Casper events, not trusted frontend claims.
- Mock mode must never be presented as real Casper settlement.

## No-Drift Rules

Future Codex sessions must keep the project aligned with the hackathon thesis.

- Do not turn this into a generic wallet, generic dApp, generic API gateway, or generic payments dashboard.
- Do not build features that hide the autonomous agent behavior.
- Do not build features that hide Casper. The demo needs a visible Casper Testnet transaction or event path.
- Do not replace the 402-style flow with a manual checkout.
- Do not rely on frontend-only policy checks.
- Do not accept receipts that are not request-bound.
- Do not add multi-chain support before the Casper demo is complete.
- Do not add broad merchant onboarding before the protected-resource demo works.
- Do not add complex token economics before policy-controlled agent payments work.
- Do not change hash formulas without updating `docs/protocol-spec.md`, tests, and fixtures.

## Done Criteria For Future Tasks

A future task is done only when:

- It preserves the product thesis and no-drift rules.
- It keeps mock mode and real Casper mode behavior compatible.
- It updates protocol docs when protocol objects or hash formulas change.
- It includes tests for changed policy, gateway, payment, or receipt behavior.
- It exposes enough audit information for the dashboard and demo script.
- It fails closed for invalid, expired, over-budget, replayed, or mismatched payments.
- It avoids unrelated refactors.
- It can be explained in the 3-minute demo narrative.

