# Security Policy

## Supported Branch

Security fixes are handled on `main` for the current hackathon prototype.

## Reporting a Vulnerability

Please open a private GitHub security advisory if available. If not, contact the repository owner through GitHub and avoid posting exploit details publicly.

Include:

- Affected component or file path
- Reproduction steps
- Expected and observed behavior
- Any relevant logs with secrets removed

## Secrets Policy

Never commit `.env`, PEM files, wallet files, private keys, seed phrases, API tokens, or credentials. If a secret is exposed, rotate it immediately and remove it from history before relying on the repository again.

## Project Boundary

CSPR AgentPay Guard is a hackathon prototype. Payment execution is mock mode. The Casper Testnet component records proof data on-chain through `AgentPayProofRecorder`; it is not production escrow, custody, or real CSPR settlement.
