# AgentPay Guard MCP Server

This project-owned server exposes CSPR AgentPay Guard through the official Model Context Protocol SDK. It is not an official Casper MCP server.

## Judge workflow

```bash
pnpm demo:mcp:judge
```

The command creates an actual MCP client and server over an SDK-supported in-memory transport. Tool calls execute the existing guarded x402 normalization, policy evaluation, injected no-spend settlement adapter, PAYMENT-SIGNATURE retry, and PAYMENT-RESPONSE verification before the endpoints close cleanly.

It requires no paid API, private key, signer, Casper credentials, or funds.

## First-class tools

| Tool | Purpose |
|---|---|
| `agentpay_run_rwa_due_diligence` | Run the deterministic MAD-001 agent journey from protected request and HTTP 402 through ordered policy checks and premium data. |
| `agentpay_evaluate_payment` | Evaluate allowed, payee-substitution, amount-escalation, resource-substitution, expiry, and replay scenarios. |
| `agentpay_get_verified_testnet_payment` | Read only the committed public evidence for the existing verified payment. |
| `agentpay_security_model` | Return the concise fail-closed wallet invariants. |

All four judge tools are deterministic and no-spend. They never call a signer or submitter.

## Legacy deterministic demo tools

The server retains `agentpay_status`, `setup_demo`, `call_paid_resource`, `authorize_requirement`, `settle_payment`, and `get_audit_timeline` for backward compatibility with the older local mock lifecycle. Their MCP titles and descriptions explicitly label that boundary.

That legacy lifecycle may use `X-AgentPay-Receipt` and mock receipt states internally. The current real guarded x402 path instead uses official v2 `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` transport headers with a project-specific native-CSPR payload.

## Direct stdio server

```bash
pnpm --filter @cspr-agentpay/mcp-server dev
```

The stdio server waits for an MCP client. Legacy paid-resource tools additionally require the local paid API; the four judge tools do not.

## Safety and evidence boundaries

- Hosted and MCP judge scenarios have no signer and move no funds.
- Public Testnet evidence comes from `docs/evidence/first-guarded-testnet-payment.json`.
- The evidence tool never reads `.agentpay` state, wallet files, keys, or environment secrets.
- One separate real guarded payment already exists; the judge command does not create another.
- The Odra proof recorder is a separate audit path, not payment settlement, escrow, or custody.
- The project-specific native-CSPR payload is not an official Casper x402 scheme.

## Tests

```bash
pnpm --filter @cspr-agentpay/mcp-server test
```

The integration suite performs a real MCP handshake, tool discovery, allowed flow, payee-substitution denial, replay denial, evidence retrieval, no-spend verification, invalid-input rejection, secret-field checks, and clean shutdown.
