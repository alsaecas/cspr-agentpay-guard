import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "artifacts", "video");
const FINAL_VIDEO = path.join(OUTPUT_DIR, "cspr-agentpay-browser-demo.webm");

const VIEWPORT = { width: 1280, height: 720 } as const;
const HOME_URL = "http://localhost:3000/";
const JUDGE_URL = "http://localhost:3000/judge";
const DEMO_URL = "http://localhost:3000/demo";
const PAYMENTS_URL = "http://localhost:3000/payments";
const AUDIT_URL = "http://localhost:3000/audit";

const START_HINT = [
  "Start the dashboard first:",
  "pnpm --filter @cspr-agentpay/web dev",
].join("\n");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return { ok: response.ok, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function assertLocalAppReady() {
  try {
    const dashboard = await fetchJson(JUDGE_URL, 5000);
    if (!dashboard.ok) {
      throw new Error(`Dashboard returned HTTP ${dashboard.status}`);
    }
  } catch (error) {
    throw new Error(
      `${START_HINT}\n\nDashboard check failed: ${String(error)}`,
    );
  }

}

async function waitForReadablePage(page: Page, ms: number) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => {});
  await sleep(ms);
}

async function cleanLocalPageChrome(page: Page) {
  await page
    .addStyleTag({
      content: `
        button[aria-label="Open Next.js Dev Tools"],
        [data-nextjs-dev-tools-button],
        nextjs-portal {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `,
    })
    .catch(() => {});
}

async function gotoLocal(page: Page, url: string, pauseMs = 3500) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await cleanLocalPageChrome(page);
  await waitForReadablePage(page, pauseMs);
}

async function focusSection(page: Page, text: string, pauseMs = 3200) {
  await page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded();
  await sleep(pauseMs);
}

async function runScenario(page: Page, scenario: string, resultText: string) {
  await page.locator("select").selectOption(scenario);
  await page.getByRole("button", { name: /run agentpay demo/i }).click();
  await page.getByText(resultText, { exact: false }).first().waitFor({ timeout: 30000 });
  await sleep(3000);
}

async function runCheck() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  await browser.close();

  console.log("video:check OK");
  console.log("Playwright Chromium can launch.");
  console.log(`Output path: ${FINAL_VIDEO}`);
  console.log("Recording check does not require .env or private keys.");
}

async function record() {
  await assertLocalAppReady();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await rm(FINAL_VIDEO, { force: true });

  const browser = await chromium.launch({
    headless: process.env.VIDEO_HEADED === "1" ? false : true,
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    recordVideo: {
      dir: OUTPUT_DIR,
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();

  try {
    await gotoLocal(page, HOME_URL, 3500);
    await gotoLocal(page, JUDGE_URL, 3000);
    await focusSection(page, "Three decisions a judge can verify");
    await focusSection(page, "Verified Testnet Payment");
    await focusSection(page, "MCP Agent Interface");
    await focusSection(page, "Real versus hosted");
    await focusSection(page, "Separate Odra Proof Recorder");

    await gotoLocal(page, DEMO_URL, 2000);
    await runScenario(page, "allowed-payment", "Guard Decision: ALLOW");
    await runScenario(page, "prompt-injection-attack", "Guard Decision: DENY");
    await runScenario(page, "replay-attack", "Guard Decision: DENY");
    await gotoLocal(page, PAYMENTS_URL, 4500);
    await gotoLocal(page, AUDIT_URL, 4500);
    await gotoLocal(page, JUDGE_URL, 2500);
    await focusSection(page, "Judge links", 4500);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    const tempVideoPath = await video?.path();
    if (!tempVideoPath) {
      throw new Error("Playwright did not produce a video file.");
    }
    await rename(tempVideoPath, FINAL_VIDEO);
  }

  console.log(`Recorded browser demo: ${FINAL_VIDEO}`);
}

async function main() {
  if (process.argv.includes("--check")) {
    await runCheck();
    return;
  }

  await record();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
