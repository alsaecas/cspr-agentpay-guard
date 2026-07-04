# Scripts

Utility scripts for demo and setup workflows.

- `demo/`: demo runners and scripted judge flows.
- `setup/`: local setup checks and future Testnet setup helpers.
- `record-demo-video.ts`: silent browser recording workflow for the DoraHacks demo.
- `video-prep.sh`: printable checklist for starting the local app and recording footage.

The root `pnpm demo:mock` command currently runs the autonomous agent mock flow from `apps/agent`.
The root `pnpm video:record` command records browser footage into `artifacts/video/`.
