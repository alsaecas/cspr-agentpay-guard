# Product Brief

## One-Liner

CSPR AgentPay Guard is a Casper-powered payment firewall that lets autonomous AI agents pay for protected APIs, data, compute, and agent services under enforceable policy controls.

## Target User

Primary users:

- Teams building autonomous AI agents that need to buy external resources without giving agents unrestricted wallet access.
- API and data providers that want to sell machine-readable services to agents through payment-required HTTP flows.

Demo user:

- A hackathon judge watching an AI agent autonomously pay for premium data while Casper records the payment path.

## Problem

Autonomous agents increasingly need to pay for APIs, datasets, compute jobs, and other agents. Today, the usual choices are unsafe or clunky:

- Give the agent broad wallet access.
- Require a human checkout.
- Use centralized API keys with prepaid balances and weak auditability.
- Trust the merchant to record usage correctly.
- Lose request-level proof that a specific payment unlocked a specific resource.

Agents need payment autonomy, but owners need policy control, replay protection, receipts, settlement rules, and audit trails.

## Why Now

AI agents are moving from chat-only workflows to action-taking systems. They can plan, call tools, buy data, run compute, and coordinate with other agents. HTTP 402-style flows are a natural fit because they let servers express payment requirements directly in the request path. A policy-controlled payment firewall turns that flow into something enterprises and developers can trust.

## Why Casper

Casper fits this project because it can provide:

- Accountable transaction history for machine-to-machine payments.
- Smart contract enforcement for budgets, escrow, receipt status, settlement, and replay protection.
- Upgrade-friendly contract patterns suitable for evolving payment policy.
- Casper Testnet visibility for hackathon judges.
- Odra smart contracts for a fast Rust-based implementation path.
- Ecosystem alignment with CSPR.click, CSPR.cloud, and agentic commerce tooling.

## Why This Can Win

This is not a generic dApp. It is an AI-native commerce primitive with a demo judges can understand quickly:

- An agent wants premium data.
- The API demands payment.
- The agent checks its policy and pays autonomously.
- Casper records the event.
- The API releases the protected data.
- The merchant settles.
- The dashboard proves the entire chain of custody.

The winning angle is that Casper becomes the safety layer for autonomous agent spending.

## MVP Scope

The MVP must include:

- A visible policy for one demo agent.
- A merchant allowlist.
- Per-payment and total budget enforcement.
- A protected API that returns `402 Payment Required`.
- A deterministic `PaymentRequirement`.
- An autonomous agent flow that authorizes payment after checking policy.
- A request-bound `PaymentReceipt`.
- Mock Casper mode for full local demo reliability.
- Real Casper Testnet mode for at least one visible transaction or event path.
- Dashboard audit trail showing request, requirement, authorization, payment, receipt verification, protected response, settlement, and final status.

## Non-Goals

Do not build these before the MVP is proven:

- Generic consumer checkout.
- Multi-chain payments.
- Fiat payment rails.
- NFT marketplace behavior.
- Broad merchant self-serve onboarding.
- Full enterprise policy management.
- Complex dispute resolution.
- Complex agent identity standards.
- Production-grade custody.
- A generic API management platform.

## Stretch Goals

Good stretch goals after the MVP:

- Odra contract for escrow and settlement.
- Real Casper Testnet deploy links in the dashboard.
- CSPR.click payment or wallet integration.
- CSPR.cloud deployment path.
- MCP server exposing paid tools to AI agents.
- Multi-merchant demo.
- Rolling time-window budgets.
- Merchant staking or reputation.
- Signed merchant responses.
- Policy simulation before payment.
- Exportable audit report.

