# CSPR AgentPay Guard

CSPR AgentPay Guard is a policy-controlled payment firewall for autonomous AI agents. Agents can pay for protected APIs, data, compute, or other agents through HTTP 402-style flows while Casper enforces budgets, merchant allowlists, request-bound receipts, escrow, expiry, replay protection, and audit trails.

Built for the Casper Agentic Buildathon 2026, this project focuses on proving that Casper can power safe machine-to-machine commerce for autonomous systems. The intended demo shows an AI agent autonomously paying for a protected resource, with a visible Casper Testnet transaction or event path.

## Hackathon Alignment

Casper describes the Agentic Buildathon as a call to build AI-native applications for autonomous systems and machine-to-machine economies. The kickoff workshop also emphasizes Odra smart contracts, CSPR.click, CSPR.cloud, AI agents, and MCPs.

This repo is scoped around those signals:

- AI-native autonomous agent behavior.
- Machine-to-machine payment through HTTP `402 Payment Required`.
- Casper Testnet payment or escrow proof.
- Odra smart contract path for real settlement.
- Optional CSPR.click, CSPR.cloud, and MCP integrations after the core demo works.
- Security and compliance framing for controlled agent spending.

References:

- [Casper Network Agentic Buildathon 2026](https://www.casper.network/)
- [Agentic Buildathon Kickoff: Full-Stack dApp Development on Casper](https://luma.com/casper-bzn7)

## Current Status

This repository currently contains the project knowledge base and operating rules. The application has not been implemented yet.

The first build phase should create a mock-first end-to-end demo, then replace the mock Casper adapter with real Casper Testnet integration while preserving protocol objects and behavior.

## MVP Demo Goal

The winning 3-minute demo should show:

1. A user creates a policy for an autonomous agent.
2. The agent calls a paid API.
3. The API returns `402 Payment Required`.
4. The agent checks policy and authorizes payment.
5. Casper records payment, escrow, or settlement.
6. The API verifies the request-bound receipt and returns premium data.
7. The merchant settles.
8. The dashboard shows the audit trail.

## Repository Map

- [AGENTS.md](AGENTS.md): Mission, architecture, coding rules, security invariants, and no-drift rules for future coding agents.
- [docs/product-brief.md](docs/product-brief.md): Product thesis, target user, MVP scope, non-goals, and stretch goals.
- [docs/protocol-spec.md](docs/protocol-spec.md): Protocol objects, deterministic hash formulas, state transitions, and error cases.
- [docs/threat-model.md](docs/threat-model.md): Replay, receipt reuse, duplicate settlement, malicious merchant, overspending, spoofing, and mock-vs-real risks.
- [docs/demo-script.md](docs/demo-script.md): 3-minute judge-facing demo script.
- [docs/judging-alignment.md](docs/judging-alignment.md): Feature mapping to Casper Buildathon judging value.

## Protocol Commitments

The implementation must preserve these core invariants:

- Receipts are valid only for the exact request represented by `requestHash`.
- Payments are identified by deterministic `paymentId`.
- Policies enforce merchant allowlists, per-payment limits, total budgets, expiry, and resource scope.
- Duplicate settlement is rejected.
- Mock mode and real Casper mode share the same protocol surface.
- Mock mode is clearly labeled and never presented as real Casper settlement.

## License

MIT License. See [LICENSE](LICENSE).

