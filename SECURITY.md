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

CSPR AgentPay Guard is a Testnet hackathon prototype. Hosted execution is deterministic and no-spend. Separately, one guarded native-CSPR Testnet payment is publicly verified, and `AgentPayProofRecorder` records a different audit proof. Neither path is production escrow, custody, Mainnet readiness, or a security audit.
