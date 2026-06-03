# Judging Alignment

## AI-Native

CSPR AgentPay Guard is built for agents, not human checkout. The core flow starts when an AI agent calls a protected resource, receives `402 Payment Required`, evaluates policy, pays, retries with a receipt, and consumes the result.

Demo proof:

- Agent run log.
- Tool/API calls.
- Autonomous policy decision.
- Premium data consumed by the agent.

## Autonomous Agent Behavior

The user sets policy once. The agent handles the payment flow without asking the user to click a checkout button.

Demo proof:

- Agent receives payment requirement.
- Agent checks policy.
- Agent authorizes payment.
- Agent retries with receipt.

## Machine-To-Machine Payment

The merchant API and agent negotiate payment through protocol objects, not a human payment page.

Demo proof:

- HTTP `402` response.
- `PaymentRequirement`.
- `PaymentAuthorization`.
- `PaymentReceipt`.
- Backend receipt verification.

## Casper Testnet Transactions

The real-mode demo should show at least one Casper Testnet deploy or event for payment, escrow, or settlement.

Demo proof:

- Casper Testnet deploy hash.
- Link to transaction or explorer view.
- Dashboard event mapped to deploy hash.

## CSPR.click

Potential alignment:

- Use CSPR.click as a wallet or payment UX bridge where appropriate.
- Link policy owner funding, payment approval, or demo wallet setup to CSPR.click if integration time allows.

MVP stance:

- CSPR.click is a stretch integration.
- Do not block the core 402 agent payment flow on it.

## CSPR.cloud

Potential alignment:

- Deploy gateway, merchant API, dashboard, or agent service through CSPR.cloud.
- Use cloud deployment to make the demo accessible and repeatable.

MVP stance:

- CSPR.cloud is a strong stretch goal after local demo reliability.

## Odra Smart Contracts

Potential alignment:

- Implement Casper contracts in Odra for policy registry, escrow, payment state, settlement, and events.
- Emit events that map cleanly to dashboard audit records.

MVP stance:

- First implement the adapter interface and mock events.
- Then add the smallest Odra contract path needed to show real Casper Testnet proof.

## MCP Tools

Potential alignment:

- Expose paid resources as MCP tools.
- Let an AI agent discover a protected tool, receive a payment requirement, authorize payment, and call the tool again with a receipt.

MVP stance:

- MCP is a stretch feature unless it accelerates the agent demo.
- MCP tools must call the same gateway and policy engine as the HTTP demo.

## Security And Compliance

This project maps strongly to safety, compliance, and enterprise readiness because it gives autonomous agents constrained spending powers.

Feature mapping:

- Merchant allowlists reduce counterparty risk.
- Per-payment limits reduce blast radius.
- Total or rolling budgets control runaway agents.
- Request-bound receipts prevent cross-resource reuse.
- Expiry reduces stale authorization risk.
- Replay protection prevents duplicate access and settlement.
- Escrow supports fulfillment before merchant settlement.
- Audit trail supports review, compliance, and debugging.
- Casper events provide independent transaction evidence.

Demo proof:

- Show a successful payment.
- Show one rejected unsafe attempt, such as wrong merchant, over-budget amount, request hash mismatch, or duplicate settlement.

## Why Judges Should Care

CSPR AgentPay Guard positions Casper as infrastructure for the next wave of agentic commerce. The project is specific, demoable, and aligned with real pain:

- Agents need to buy things.
- Owners need enforceable limits.
- Merchants need payment proof.
- Auditors need a trail.
- Casper can provide the shared trust layer.

