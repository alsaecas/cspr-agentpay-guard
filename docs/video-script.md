# Video Script — 3-Minute Demo

## 0:00–0:20 | The Problem

"Narration: AI agents need to pay for APIs, data, and compute. But today, you either give them unrestricted wallet access — dangerous — or require human checkout at every step — defeats autonomy. We need machine-to-machine payments with policy-enforceable limits."

## 0:20–0:45 | The Solution

"Narration: CSPR AgentPay Guard solves this. It is a Casper-powered payment firewall for autonomous agents. I give my agent a spending policy: which merchants, what endpoints, per-payment max, total budget. The agent can pay autonomously, but only within those limits. Every event is recorded with a full audit trail."

## 0:45–1:45 | Live Agent Demo

"Show terminal: `pnpm demo:mock`"

"Narration: Let me run the agent. It needs a premium parking revenue report to evaluate an RWA opportunity. It calls the protected API. The API returns HTTP 402 Payment Required — a PaymentRequirement with the exact amount, merchant, and a requestHash that binds it to this specific request."

"Show: 402 response on screen"

"The agent checks policy: is this merchant allowed? Is the amount under the per-payment limit? Is there enough budget left? All yes. The agent authorizes payment."

"Show: authorization step"

"The mock adapter records the payment — deterministic local proofs with clear mock labels. The agent retries with the receipt. The API verifies it's request-bound. Premium data is released."

"Show: premium report with revenue, occupancy, confidence score"

"One payment, one receipt, one request. No reuse, no overspend, no human checkout."

## 1:45–2:25 | Dashboard Audit Trail

"Switch to: browser at http://localhost:3000/demo"

"Narration: Now let's look at the dashboard. Here is the full timeline: setup, agent call, 402 requirement, authorization, escrow, receipt retry, premium data, fulfillment, settlement. Each step is visible. The proof card shows it's a mock proof — no real funds moved."

"Show: scroll through demo page, highlight timeline, proof card, MOCK MODE badge"

"The payments tab shows every event. The audit tab has a filterable event timeline."

## 2:25–2:50 | On-Chain Proof

"Show terminal: `pnpm proof:testnet:dry-run`"

"Narration: For real Casper Testnet proof, we have the AgentPayProofRecorder contract ready. It records paymentId, requestHash, policyId, status on-chain. The dry-run validates payloads without credentials. When deployed, it will anchor AgentPay events directly on Casper Testnet."

"Show: dry-run output"

## 2:50–3:00 | Close

"Narration: CSPR AgentPay Guard gives autonomous agents constrained spending powers — merchant allowlists, per-payment limits, request-bound receipts, replay protection, escrow, settlement, and full audit trails. And Casper provides the trust layer.

This is the infrastructure for safe machine-to-machine commerce."

## On-Screen Text During Demo

- "HTTP 402 Payment Required"
- "Policy check: merchant allowlist ✓, per-payment limit ✓, budget ✓"
- "Mock Casper: payment escrowed" (mock mode)
- "Receipt is request-bound — cannot be reused"
- "Premium data: revenue, occupancy, confidence"
- "MODE: MOCK" badge always visible

## Production Notes

- Record terminal at 80×24 or larger.
- Use a dark terminal theme.
- Keep the mock mode badge visible.
- If a real Testnet transaction exists, show it and CSPR.live link at 2:35.
- If not, show the contract source and dry-run at 2:35.
