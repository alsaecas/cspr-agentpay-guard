# Final Video Script

No scene submits a payment or proof. Browser and terminal footage use public evidence and deterministic no-spend scenarios.

## Primary final video — maximum 3 minutes

### 0:00–0:20 — Problem

**Visual:** Homepage hero, then Judge Mode.

**Voiceover:** “AI agents need to buy APIs and data, but the model cannot be trusted with unrestricted wallet control. A single prompt injection could try to redirect funds or inflate a payment.”

**On-screen:** `AI chooses the task. Policy controls the wallet.`

### 0:20–0:40 — Product

**Visual:** Judge Mode architecture flow.

**Voiceover:** “AgentPay Guard is a zero-trust authorization layer between the model, x402, and the wallet. It reconstructs the server-issued requirement and checks the merchant, payee, resource, amount, budget, integrity, expiry, and replay state before signing.”

**On-screen:** `x402 rail → AgentPay Guard → wallet boundary`

### 0:40–1:15 — Agentic RWA and MCP

**Visual:** MAD-001 hero and terminal running `pnpm demo:mcp:judge`.

**Voiceover:** “Our autonomous RWA due-diligence agent needs a premium report for tokenized parking asset MAD-001. The provider returns HTTP 402. An MCP-compatible agent calls our project-owned server, built with the official Model Context Protocol SDK. Those tools invoke the product’s actual normalization and policy engine, then use an injected no-spend adapter for the x402 retry and deterministic premium response.”

**On-screen:**

```text
agentpay_run_rwa_due_diligence
agentpay_evaluate_payment
Policy ALLOW
Hosted signing: disabled
```

### 1:15–1:45 — Attack demonstration

**Visual:** Prompt-injection and replay cards; optionally switch interactive demo scenarios.

**Voiceover:** “Now malicious model output attempts to substitute the payee. The authoritative tagged public-key destination does not match, so the guard returns PAYEE_MISMATCH. The signer is never called and budget does not change. A consumed requirement nonce returns NONCE_ALREADY_USED, and no deterministic premium response is released.”

**On-screen:** `DENY · signerCalled=false · submissionCalled=false`

### 1:45–2:20 — Existing real Casper evidence

**Visual:** Verified Testnet Payment card, then the existing explorer page. Do not run a live command.

**Voiceover:** “This is separate public evidence of the real guarded path: transaction 801d558b…b4440f transferred 2.5 CSPR exactly once as a native TransactionV1 on Casper Testnet. The server independently verified the signer, payee, amount, transfer ID, execution success, and request binding through RPC. Only after PAYMENT-RESPONSE verification did it release the MAD-001 report.”

**On-screen:** `2.5 CSPR · block 8510676 · execution succeeded`

### 2:20–2:40 — Odra audit path

**Visual:** Separate Odra proof card, contract deployment, and existing proof transaction.

**Voiceover:** “The Odra AgentPayProofRecorder is a separate on-chain audit path. Its proof transaction is not the payment, not escrow, and not custody. We show both paths without conflating them.”

### 2:40–3:00 — Close

**Visual:** Real-versus-hosted cards and final CTA.

**Voiceover:** “Real payment verified. Prompt injection and replay denied before signing. MCP tools make the security boundary available to agents, while the hosted site contains no keys and cannot spend. x402 is the payment rail. AgentPay Guard is the authorization layer.”

**On-screen:** Repository, live demo, `Open Judge Mode`.

## Backup pitch — maximum 90 seconds

### 0:00–0:15

“Autonomous agents need paid data, but a language model must never have unrestricted wallet control. AgentPay Guard is the zero-trust authorization layer between x402 and the wallet.”

### 0:15–0:40

“For tokenized parking asset MAD-001, an agent receives HTTP 402 and calls our project-owned MCP server. Deterministic policy checks bind the exact merchant, payee, resource, amount, budget, integrity, expiry, and request hash before signing.”

### 0:40–0:58

“The allowed scenario passes without spending in hosted mode. Payee-substitution prompt injection fails with PAYEE_MISMATCH, the signer is not called, and replay is rejected.”

### 0:58–1:15

“Separately, one real 2.5 CSPR native TransactionV1 completed exactly once on Casper Testnet. Independent RPC verification succeeded before the premium MAD-001 report was released.”

### 1:15–1:30

“The Odra proof recorder is a separate audit path, not settlement. Hosted mode has no keys and cannot spend. x402 is the payment rail. AgentPay Guard is the authorization layer.”

## Recording prohibitions

- Do not run `pnpm demo:testnet:guarded`, `pnpm proof:testnet`, or any deploy command.
- Do not show `.env`, key paths, local wallet state, or terminal history containing secrets.
- Do not describe the payload as an official Casper x402 scheme.
- Do not describe the server as an official Casper MCP server.
- Do not claim production escrow, custody, Mainnet readiness, or a security audit.
