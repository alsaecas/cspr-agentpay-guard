# Demo Script

## 3-Minute Winning Demo

### 0:00 - 0:25: Create Policy

Show the dashboard policy screen.

Narration:

"This is CSPR AgentPay Guard: a payment firewall for autonomous AI agents. I am giving this research agent permission to spend a small CSPR budget, but only with this allowlisted market-data merchant and only for this premium endpoint."

Visible proof:

- Agent ID.
- Merchant allowlist.
- Per-payment limit.
- Total budget.
- Expiry.
- Mode indicator: mock or real Casper Testnet.

### 0:25 - 0:50: Agent Calls Paid API

Run the agent.

Narration:

"The agent is not using a human checkout. It is just trying to do its job: fetch premium data."

Expected event:

- Agent calls protected API.
- API returns `402 Payment Required`.
- Dashboard logs `PaymentRequirement` with amount, merchant, URL, expiry, and `requestHash`.

### 0:50 - 1:20: Agent Authorizes Payment

Show the agent evaluating the requirement against policy.

Narration:

"The agent receives the payment requirement, checks merchant, amount, resource, expiry, and remaining budget, then authorizes exactly one request-bound payment."

Expected event:

- Policy check passes.
- `PaymentAuthorization` is created.
- `paymentId` is shown.
- Budget reserved or spent amount updates.

### 1:20 - 1:55: Casper Records Payment

Show Casper path.

Narration:

"Now the payment moves through Casper. In mock mode we get deterministic local events for demo reliability. In real mode this is a Casper Testnet deploy and event path."

Expected event:

- Mock mode: dashboard shows `mock-deploy-*` and `mock-event-*`.
- Real mode: dashboard shows Casper Testnet deploy hash and link.
- Receipt status becomes `escrowed`.

### 1:55 - 2:20: API Returns Premium Data

Show the agent retrying the original API request with the receipt.

Narration:

"The gateway recomputes the request hash. Because the receipt is bound to this exact method, URL, merchant, agent, and body, the API releases the premium data."

Expected event:

- Receipt verification succeeds.
- API returns premium data.
- Dashboard logs `fulfilled`.

### 2:20 - 2:45: Merchant Settles

Trigger settlement.

Narration:

"After fulfillment, the merchant settles the escrow. The same payment ID cannot be settled twice."

Expected event:

- Settlement request succeeds.
- Payment state becomes `settled`.
- Optional duplicate settlement attempt is rejected with `DUPLICATE_SETTLEMENT`.

### 2:45 - 3:00: Audit Trail Close

Show final audit trail.

Narration:

"The point is not just that an agent paid. The point is that every autonomous payment is policy-controlled, request-bound, replay-protected, and visible through Casper."

Final visible checklist:

- `402 Payment Required`.
- Policy authorization.
- `requestHash`.
- `paymentId`.
- Casper deploy or event.
- Premium data returned.
- Settlement.
- Final audit trail.

## Demo Success Criteria

The demo wins if a judge can say:

- The agent acted autonomously.
- The payment was machine-to-machine.
- Policy prevented unsafe spending.
- Casper provided visible transaction or event proof.
- The protected resource was released only after receipt verification.

