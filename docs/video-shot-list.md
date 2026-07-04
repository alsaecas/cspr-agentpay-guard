# Video Shot List — Automated Browser Clip

Use this shot list to produce the silent browser footage that will later be edited with voiceover, captions, and a title card.

## Automated Browser Recording

Start the local services in separate terminals:

```bash
pnpm --filter @cspr-agentpay/paid-api dev
pnpm --filter @cspr-agentpay/web dev
```

Record browser footage:

```bash
pnpm video:record
```

Output:

```text
artifacts/video/cspr-agentpay-browser-demo.webm
```

The recorder does not read `.env`, does not print keys, and does not submit new Casper transactions. It shows the local mock payment execution plus the already real Casper Testnet deploy/proof pages.

## Pages Recorded

1. `http://localhost:3000/demo`
   - Shows the dashboard in mock mode.
   - Clicks **Run AgentPay Demo**.
   - Waits for the policy/payment/proof cards to render.

2. `http://localhost:3000/payments`
   - Shows the payment lifecycle after the demo run.
   - Keep the mock-mode label visible.

3. `http://localhost:3000/audit`
   - Shows the audit trail derived from backend records.
   - Use this for the narration about request-bound receipts and replay protection.

4. `https://testnet.cspr.live/deploy/b03078ffe751d10b01aa761cd2d9cb0032f7ea2f206064a3647521cdd8f3442c`
   - Real Casper Testnet contract deploy transaction.
   - Use this for the on-chain component requirement.

5. `https://testnet.cspr.live/deploy/9bf7e42d1763c3933c29617c564135067d45907b57c3cda4b2caffce902c6409`
   - Real Casper Testnet `record_proof` transaction.
   - Use this for the proof transaction requirement.

## Captions To Add In Editing

- "Mock payment execution: no real CSPR moves in the local browser flow."
- "Real Casper Testnet contract deployment."
- "Real Casper Testnet proof transaction."
- "Proof recorder only: no production escrow or custody."
- "Request-bound receipts prevent replay across URL, method, or body."

## Editing Plan

1. Import `artifacts/video/cspr-agentpay-browser-demo.webm` into Canva, CapCut, or iMovie.
2. Add a title card: "CSPR AgentPay Guard".
3. Add the voiceover from `docs/video-script.md`.
4. Add captions for "mock payment execution" and "real Casper Testnet proof transaction".
5. Trim loading pauses, but keep enough time to read the dashboard and CSPR.live hashes.
6. Export the final video.
7. Upload to YouTube as Unlisted.

## Safety Checklist

- Do not show `.env`.
- Do not show PEM files or private keys.
- Do not show `mock-*` hashes on CSPR.live.
- Do not describe the proof recorder as production escrow, custody, or real CSPR settlement.
- Do describe the Casper Testnet proof transaction as real.
