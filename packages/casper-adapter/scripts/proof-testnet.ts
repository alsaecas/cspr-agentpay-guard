#!/usr/bin/env node

/**
 * proof:testnet — Submit an AgentPay proof anchor to Casper Testnet.
 *
 * Usage:
 *   pnpm proof:testnet
 *   pnpm proof:testnet:dry-run
 *
 * This script validates env vars and either:
 * - submits a real proof (when credentials are configured), or
 * - performs a dry-run (always safe, no credentials needed).
 */

import { blake2b256Hex } from "../../protocol/src/hash.js";

import { RealCasperTestnetAdapter } from "../src/real.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv.includes("--dry-run") ? "dry-run" : "testnet";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

function loadDotEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key]) {
      continue;
    }
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

// A dry run must be safe even on a workstation that has live credentials.
// Do not read .env unless the explicitly selected mode can submit.
if (mode !== "dry-run") {
  loadDotEnv(resolve(repoRoot, ".env"));
}

// ---------------------------------------------------------------------------
// Build a sample proof payload
// ---------------------------------------------------------------------------

const samplePayload = {
  paymentId: blake2b256Hex(
    `CSPR_AGENTPAY_PAYMENT_V1\ntestnet-proof-demo\nmerchant\ndemo\n1000000000\nendpoint\nrequestHash\nnonce`,
  ),
  requestHash: blake2b256Hex(
    `CSPR_AGENTPAY_REQUEST_V1\nGET\nhttp://127.0.0.1:4000/premium/parking-report/MAD-001\n${blake2b256Hex("{}")}\nparking-report-v1\nmerchant_market_data_001\nagent_research_001\nnonce\n${new Date(Date.now() + 3600000).toISOString()}`,
  ),
  policyId: "policy_demo_agent_001",
  merchantId: "merchant_market_data_001",
  status: "escrowed",
  receiptHash: blake2b256Hex("mock proof receipt"),
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("═".repeat(64));
console.log("CSPR AgentPay Guard — Casper Testnet Proof");
console.log(`Mode: ${mode}`);
console.log("═".repeat(64));
console.log("");

const network = process.env.CASPER_NETWORK ?? "casper-test";
const rpcUrl =
  process.env.CASPER_RPC_URL ?? "https://node.testnet.casper.network/rpc";

console.log(`Network:   ${network}`);
console.log(`RPC URL:   ${rpcUrl}`);
console.log("");

// Check chain env vars (CSPR.cloud is optional)
const missing = RealCasperTestnetAdapter.getMissingChainEnvVars();
if (missing.length > 0) {
  console.log("⚠ Missing environment variables:");
  for (const name of missing) {
    console.log(`  - ${name}`);
  }
  console.log("");
}

// Dry-run payload validation
const dryRun = RealCasperTestnetAdapter.buildProofDryRun({
  ...samplePayload,
});

console.log("Proof payload:");
for (const [k, v] of Object.entries(dryRun.payload)) {
  console.log(`  ${k}: ${v}`);
}
console.log("");

console.log(`Proof kind: ${dryRun.proof.kind}`);
console.log("Deploy/transaction hash: (pending real submission)");
console.log("");

if (mode === "dry-run") {
  console.log("Dry-run complete. No transaction submitted.");
  console.log("");
  console.log("To submit a real proof:");
  console.log("  1. Set required env vars in .env (see .env.example)");
  console.log(
    "  2. Deploy the AgentPay proof recorder contract to Casper Testnet",
  );
  console.log("  3. Run: pnpm proof:testnet");
  console.log("");
  console.log("Real proof requires:");
  console.log("  - CASPER_TESTNET_PUBLIC_KEY");
  console.log("  - CASPER_TESTNET_SECRET_KEY_PATH");
  console.log("  - CASPER_AGENTPAY_CONTRACT_HASH");
  console.log("  - CASPER_RPC_URL (optional; defaults to Testnet RPC)");
  console.log("  - CASPER_PROOF_GAS_MOTES (optional)");
  console.log("");
  process.exit(0);
}

// Real mode — attempt submission
if (missing.length > 0) {
  console.log(
    "Cannot submit real proof. Set the missing env vars listed above.",
  );
  console.log(
    "Run pnpm proof:testnet:dry-run for payload validation without credentials.",
  );
  process.exit(1);
}

const result =
  await RealCasperTestnetAdapter.recordAgentPayProof(samplePayload);

console.log(`Submitted: ${result.submitted}`);
console.log(`Message: ${result.message}`);
console.log("");

if (result.proof.kind === "legacy-deploy" && result.proof.deployHash) {
  const deployHash = result.proof.deployHash;
  console.log(`Deploy hash: ${deployHash}`);
  console.log(`CSPR.live:   https://testnet.cspr.live/deploy/${deployHash}`);
}

if (result.proof.kind === "transaction-v1" && result.proof.transactionHash) {
  const transactionHash = result.proof.transactionHash;
  console.log(`Transaction hash: ${transactionHash}`);
  console.log(
    `CSPR.live:        https://testnet.cspr.live/deploy/${transactionHash}`,
  );
}

if (!result.submitted) {
  console.log("");
  console.log("No real Casper Testnet proof was submitted.");
  console.log("Setup checklist:");
  console.log("  1. Fund the Testnet account for gas.");
  console.log(
    "  2. Deploy AgentPayProofRecorder and set CASPER_AGENTPAY_CONTRACT_HASH.",
  );
  console.log(
    "  3. Set CASPER_TESTNET_PUBLIC_KEY and CASPER_TESTNET_SECRET_KEY_PATH.",
  );
  console.log("  4. Re-run pnpm proof:testnet.");
  process.exit(1);
}

console.log("═".repeat(64));
