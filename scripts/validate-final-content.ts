import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
let errors = 0;

function fail(message: string) {
  console.error(`FAIL: ${message}`);
  errors += 1;
}

function required(relative: string) {
  if (!existsSync(path.join(root, relative))) fail(`missing ${relative}`);
}

const requiredFiles = [
  "apps/web/app/judge/page.tsx",
  "docs/evidence/first-guarded-testnet-payment.json",
  "docs/hackathon-requirements-matrix.md",
  "docs/dorahacks-final-update.md",
  "docs/video-recording-runbook.md",
  "docs/video-captions.srt",
];
requiredFiles.forEach(required);

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
if (!packageJson.scripts?.["demo:mcp:judge"]) fail("missing demo:mcp:judge command");

const evidence = JSON.parse(readFileSync(
  path.join(root, "docs/evidence/first-guarded-testnet-payment.json"), "utf8",
)) as Record<string, unknown>;
for (const field of ["transactionHash", "requestHash", "paymentId", "authorizationHash", "requirementHash", "signerAccountHash", "payeeAccountHash", "blockHash"]) {
  if (!/^[a-f0-9]{64}$/.test(String(evidence[field] ?? ""))) fail(`invalid 64-character evidence hash: ${field}`);
}

const contractEvidence = readFileSync(path.join(root, "docs/dorahacks-final-update.md"), "utf8");
for (const label of ["Contract", "Deployment", "Existing proof"]) {
  const match = contractEvidence.match(new RegExp("- " + label + ": `([a-f0-9]+)`"));
  if (!match || match[1]?.length !== 64) fail(`invalid ${label.toLowerCase()} hash length`);
}

const currentDocs = [
  "README.md",
  "docs/submission.md",
  "docs/final-checklist.md",
  "docs/final-round-playbook.md",
  "docs/dorahacks-final-update.md",
  "docs/video-script.md",
  "docs/video-shot-list.md",
  "docs/video-recording-runbook.md",
  "docs/testnet-status.md",
  "docs/x402-integration.md",
];

const combined = currentDocs.map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");
if (/Mainnet[- ]ready/i.test(combined)) fail("accidental Mainnet-ready claim");
if (/production escrow (?:is|available|implemented)/i.test(combined)) fail("accidental production escrow claim");
if (/(?:is|uses|provides) (?:an? )?official Casper (?:x402|MCP) (?:standard|server|scheme)\b/i.test(combined)) fail("accidental official Casper integration claim");
if (/demo video\s*:\s*pending/i.test(combined)) fail("stale demo-video pending wording");

for (const file of currentDocs) {
  const lines = readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    if (line.includes("X-AgentPay-Receipt") && !/legacy|older/i.test(line)) {
      fail(`${file}:${index + 1} has an unqualified legacy receipt header`);
    }
  });
}

const publicVideoUrl = combined.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\/\S+/i);
if (publicVideoUrl && /pending upload|add after manual upload|add final public video/i.test(combined)) {
  fail("public video URL exists but pending placeholder remains");
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const absolute = path.join(dir, name);
    if (["node_modules", ".git", "target", ".next"].includes(name)) return [];
    if (statSync(absolute).isDirectory()) return markdownFiles(absolute);
    return absolute.endsWith(".md") ? [absolute] : [];
  });
}

for (const file of markdownFiles(root)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1]?.trim();
    if (!target || target.startsWith("#") || /^(?:https?:|mailto:)/.test(target)) continue;
    const clean = decodeURIComponent(target.split("#")[0] ?? "").replace(/^<|>$/g, "");
    if (clean && !existsSync(path.resolve(path.dirname(file), clean))) {
      fail(`broken internal Markdown link in ${path.relative(root, file)}: ${target}`);
    }
  }
}

if (errors > 0) process.exit(1);
console.log("Final-round content validation passed.");
