# Final Checklist — CSPR AgentPay Guard

## Build and Test

```bash
pnpm install             # [ ] Done
pnpm typecheck           # [ ] 7/7 pass
pnpm test                # [ ] 144 tests pass
pnpm demo:mock           # [ ] Agent demo runs, prints story
pnpm --filter @cspr-agentpay/web build  # [ ] Build succeeds
pnpm proof:testnet:dry-run               # [ ] Dry-run works
```

## Contract

```bash
pnpm contract:check      # [ ] Tooling verified
pnpm contract:build      # [ ] wasm compiled (if tooling available)
pnpm contract:test       # [ ] cargo test --lib passes
pnpm contract:deploy:testnet  # [ ] Deploy to testnet (if credentials)
```

## Demo Paths

```bash
# Demo A — Terminal (reliable)
pnpm demo:mock                          # [ ] Works

# Demo B — Dashboard
# Terminal 1: pnpm --filter @cspr-agentpay/paid-api dev
# Terminal 2: pnpm --filter @cspr-agentpay/web dev
# Browser: http://localhost:3000/demo   # [ ] Works

# Demo C — Testnet proof
pnpm proof:testnet:dry-run              # [ ] Works
pnpm proof:testnet                      # [ ] Works or graceful exit
```

## Docs Checklist

- [ ] README.md — How to Demo, Real vs Mock, implementation plan
- [ ] docs/submission.md — Complete submission doc
- [ ] docs/video-script.md — 3-minute video script
- [ ] docs/final-checklist.md — This file
- [ ] docs/testnet-status.md — Honest Testnet status
- [ ] docs/casper-contract-boundary.md — Contract boundary spec
- [ ] docs/technical-spike.md — Integration strategy
- [ ] docs/demo-script.md — Original demo script
- [ ] docs/judging-alignment.md — Judging criteria mapping
- [ ] contracts/README.md — Contract scaffold status
- [ ] apps/web/README.md — Dashboard instructions
- [ ] apps/agent/README.md — Agent demo instructions

## Submission Links

- [ ] GitHub repo: https://github.com/alsaecas/cspr-agentpay-guard
- [ ] Video (3 min): [URL pending]
- [ ] Live demo URL (if deployed): [URL pending]

## No Production Escrow Disclaimer

**This project does not implement production escrow, custody, or real CSPR settlement. All mock proofs use deterministic `mock-*` hashes. The AgentPayProofRecorder contract is an audit anchor — not a payable escrow contract.**
