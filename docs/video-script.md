# Video Script — 3-Minute Demo

Use this script for the final DoraHacks recording. The real Casper Testnet proof path is complete; keep the mock/local flow and real Testnet proof clearly distinguished.

## Automated Browser Recording

Start the local API and dashboard in separate terminals:

```bash
pnpm --filter @cspr-agentpay/paid-api dev
pnpm --filter @cspr-agentpay/web dev
```

Prepare the recording:

```bash
pnpm video:prep
```

Record the silent browser clip:

```bash
pnpm video:record
```

Output:

```text
artifacts/video/cspr-agentpay-browser-demo.webm
```

Editing plan:

- Import the WebM into Canva, CapCut, or iMovie.
- Add a title card.
- Add the voiceover below.
- Add captions for "mock payment execution" and "real Casper Testnet proof transaction".
- Export the final video.
- Upload to YouTube as Unlisted.

## Voiceover For Automated Browser Footage

"CSPR AgentPay Guard is a policy-controlled payment firewall for autonomous AI agents. The problem is simple: agents increasingly need to buy APIs, data, compute, and services, but unrestricted wallet access is unsafe, and manual checkout breaks autonomy."

"This demo shows an HTTP 402 payment flow. The agent requests a protected parking revenue report. The gateway responds with Payment Required and includes a request-specific PaymentRequirement: merchant, amount, resource, expiry, nonce, and request hash."

"The agent does not blindly pay. It evaluates an AgentPolicy first. The policy checks the merchant allowlist, resource scope, per-payment limit, total budget, expiry, and replay fields. Only after those deterministic checks pass does the agent authorize one request-bound payment."

"In the browser dashboard, the payment execution path is mock mode. That is intentional for the repeatable demo: no real CSPR moves in the local HTTP 402 flow. The mock adapter uses the same proof object shape and state transitions as the real adapter, so the dashboard can show authorization, escrowed state, fulfillment, settlement, and audit records without claiming local mock hashes are Casper transactions."

"Next, the payments page shows the lifecycle for the generated payment. The receipt is bound to the exact request hash, so it cannot be reused for a different URL, method, or body. The audit page shows the backend-derived event trail: setup, 402 requirement, policy authorization, receipt retry, premium data release, fulfillment, and settlement."

"The Casper Testnet component is real. CSPR AgentPay Guard deploys an Odra AgentPayProofRecorder contract to Casper Testnet. The first CSPR.live page is the real contract deployment transaction. The second CSPR.live page is a real record_proof transaction submitted to that deployed contract. It records paymentId, requestHash, policyId, merchantId, status, and optional receiptHash on-chain."

"The important distinction is this: browser scenarios are deterministic and safe for demo repetition. The guarded native-CSPR payment is a separate, real TransactionV1 that released data after RPC verification. The Odra proof transaction is also real but is a distinct audit anchor. This project does not claim production escrow, custody, Mainnet readiness, or official Casper x402 standardization."

## 0:00-0:20 | Problem

Narration:

"AI agents need to buy APIs, data, and compute. But unrestricted wallet access is dangerous, and human checkout breaks autonomy. We need machine-to-machine payments with enforceable policy limits, request-bound receipts, replay protection, and an audit trail."

Show:

- Project title: CSPR AgentPay Guard
- One sentence: "Policy-controlled HTTP 402 payments for autonomous agents"

## 0:20-0:45 | Solution

Narration:

"CSPR AgentPay Guard is a payment firewall for autonomous agents. The owner defines an AgentPolicy: allowed merchants, allowed resources, per-payment maximum, total budget, and expiry. The agent can pay automatically, but only inside those rules."

Show:

- `README.md` architecture diagram or dashboard home page
- Policy fields on the dashboard

## 0:45-1:35 | Local Agent Demo

Show terminal:

```bash
pnpm demo:mock
```

Narration:

"The agent needs a premium parking revenue report for an RWA due diligence task. It calls the protected API and receives HTTP 402 Payment Required. The response includes a PaymentRequirement with merchant, amount, endpoint, expiry, nonce, and requestHash."

"The agent checks policy. Merchant allowlist passes, resource scope passes, per-payment limit passes, and total budget passes. It authorizes one request-bound payment."

"In this local demo, the Casper adapter is mock mode, clearly labeled. It records the same proof fields and state transitions the real adapter uses, but no CSPR moves."

Show:

- 402 step
- authorization step
- mock proof hash
- premium response
- "MOCK MODE — no real Casper funds were moved"

## 1:35-2:15 | Dashboard Audit Trail

Show browser:

```bash
pnpm --filter @cspr-agentpay/paid-api dev
pnpm --filter @cspr-agentpay/web dev
open http://localhost:3000/demo
```

Click **Run AgentPay Demo**.

Narration:

"The dashboard is the judge-facing audit view. It shows setup, 402 requirement, policy authorization, mock proof, receipt retry, premium data, fulfillment, and settlement state. The payment and audit pages are derived from backend records, not frontend claims."

Show:

- Demo timeline
- Proof card with mock label
- Payments page
- Audit page

## 2:15-2:45 | Casper Testnet Proof Step

Show:

```bash
pnpm proof:testnet:dry-run
pnpm contract:check
pnpm contract:build
```

Narration:

"The Casper component is deployed on Testnet. It is an Odra AgentPayProofRecorder contract that records paymentId, requestHash, policyId, merchantId, status, and optional receiptHash on-chain. Now I submit one AgentPay proof transaction to the deployed contract and open the CSPR.live Testnet page for the real hash."

Show:

```bash
pnpm proof:testnet
```

Then open `docs/testnet-status.md` and the real CSPR.live Testnet proof link:

https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409

## 2:45-3:00 | Close

Narration:

"CSPR AgentPay Guard gives autonomous agents constrained spending power: HTTP 402 payment requirements, deterministic policy checks, request-bound receipts, replay protection, and a visible audit trail. Casper provides the proof anchor path for verifying AgentPay events on-chain."

Final on-screen text:

- "Mock local flow: complete"
- "Casper Testnet proof: complete"
- "Odra proof recorder: built"
- "Casper Testnet proof: real CSPR.live link"
- "No production escrow or custody"

## Recording Checklist

- Use a terminal wide enough to show the timeline cleanly.
- Keep mock mode labels visible.
- Do not show `.env` or secret key paths if they reveal local secrets.
- Do not show a `mock-*` hash on CSPR.live.
- Show the real CSPR.live Testnet proof page from `docs/testnet-status.md`.
