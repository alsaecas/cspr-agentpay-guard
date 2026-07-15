# Final Video Recording Runbook

## Safe preparation

1. Use a clean desktop and close terminals that may contain credentials.
2. Do not open `.env`, wallet state, key paths, or secret managers.
3. Install dependencies with `pnpm install`.
4. Run `pnpm video:check`.
5. Start only the web application: `pnpm --filter @cspr-agentpay/web dev`.
6. Confirm `http://localhost:3000/judge` loads without a paid API or credentials.

## Record the silent browser clip

Run `pnpm video:record`. The script records only local deterministic pages and public explorer evidence. It does not call payment, proof, or deploy scripts.

Expected output: `artifacts/video/cspr-agentpay-browser-demo.webm`.

The artifact is intentionally ignored by Git. Do not upload it from automation.

## Optional terminal insert

In a clean terminal run `pnpm demo:mcp:judge`. This uses a real MCP SDK client/server connection but no signer, submitter, paid API, key, or Testnet credential.

## Manual quality check

- Review desktop and mobile widths.
- Confirm the real-versus-hosted cards are readable.
- Confirm payment and proof hashes are public and truncated safely.
- Confirm no local filesystem path appears in the captured frame.
- Confirm no live-spend control exists.
- Confirm only the stable production URL is spoken or captioned.

## Edit and publish manually

1. Add the primary voiceover or 90-second backup.
2. Import `docs/video-captions.srt`.
3. Export at 1080p or 720p within the platform limit.
4. Upload manually.
5. Replace the video placeholder in current docs and DoraHacks copy.
6. Run `pnpm docs:check` before the final content update.

## Forbidden commands during recording

- `pnpm demo:testnet:guarded`
- `pnpm proof:testnet`
- `pnpm contract:deploy:testnet`

Dry-run output is not needed in the video. The existing verified evidence is the judge-facing proof.
