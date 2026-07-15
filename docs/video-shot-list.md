# Final Video Shot List

The automated clip is silent browser footage for editing. It prioritizes judge comprehension and never submits a transaction.

| Time | Shot | Required content | Caption |
|---|---|---|---|
| 0:00–0:10 | Homepage | Product statement and Judge Mode CTA | Firewall for AI wallets |
| 0:10–0:30 | Judge hero | MAD-001 use case and thesis | x402 rail. AgentPay authorization. |
| 0:30–0:42 | Architecture | Agent → 402 → guard → Casper boundary → verification → data | Deterministic checks before signing |
| 0:42–0:58 | Payment card | Tagged payee, account hash, 2.5 CSPR, block, execution | Existing verified Testnet TransactionV1 |
| 0:58–1:16 | MCP section | Four real tool names and no-spend boundary | Project-owned MCP server · actual guard flow |
| 1:16–1:28 | Real versus hosted | Three boundary cards | Hosted no-spend · real payment · separate proof |
| 1:28–1:42 | Allowed scenario | Actual ordered guard checks and deterministic premium response | ALLOW · no-spend adapter |
| 1:42–1:56 | Prompt injection | Payee substitution denied, signer false | PAYEE_MISMATCH — denied before signing |
| 1:56–2:10 | Replay | Consumed nonce rejected | NONCE_ALREADY_USED |
| 2:12–2:30 | Payment explorer | Existing public transaction only | Independent RPC verification succeeded |
| 2:30–2:43 | Odra card | Contract, deploy, existing proof | Separate audit proof — not settlement |
| 2:55–3:00 | Final CTA | Repository and Judge Mode | x402 is the rail. AgentPay Guard is authorization. |

## Capture requirements

- 1280×720 browser recording.
- Browser B-roll includes only the homepage, `/judge`, and `/demo`.
- Empty Payments and Audit pages are excluded.
- Transaction strings truncate or wrap safely.
- No console, hydration, or horizontal overflow errors.
- Do not show a Vercel preview URL as the public final URL.
- Do not require the local paid API; hosted/self-contained demo state is sufficient.
- Do not commit the WebM artifact.

## Separate manual inserts

Capture these outside browser automation so the editor can control terminal and public explorer framing:

- `pnpm demo:mcp:judge`;
- the existing CSPR.live payment transaction;
- the existing contract deployment; and
- the existing proof transaction.

## Editing checklist

- Add voiceover from `docs/video-script.md`.
- Import `docs/video-captions.srt` and correct timing after the final edit.
- Keep the payment and Odra proof clearly separated.
- Never imply a new live transaction was executed during recording.
- End before 3:00; use the 90-second backup if necessary.
