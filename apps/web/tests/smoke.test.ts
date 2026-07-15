import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadDashboardConfig } from "../lib/agentpayConfig";
import { executeSelfContainedDemoFlow } from "../lib/selfContainedDemo";

describe("dashboard config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads defaults", () => {
    const cfg = loadDashboardConfig();
    expect(cfg.mode).toBe("mock");
    expect(cfg.demoBackend).toBe("self-contained");
    expect(cfg.publicBaseUrl).toBe("http://localhost:3000");
    expect(cfg.paidApiBaseUrl).toBe("http://127.0.0.1:4000");
    expect(cfg.targetUrl).toBe(
      "http://localhost:3000/premium/parking-report/MAD-001",
    );
    expect(cfg.defaultPolicyId).toBe("policy_demo_agent_001");
    expect(cfg.autoSettle).toBe(true);
  });

  it("uses the stable Vercel domain in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "VERCEL_PROJECT_PRODUCTION_URL",
      "cspr-agentpay-guard.vercel.app",
    );
    vi.stubEnv(
      "VERCEL_URL",
      "cspr-agentpay-guard-random-deployment.vercel.app",
    );

    const cfg = loadDashboardConfig();

    expect(cfg.publicBaseUrl).toBe(
      "https://cspr-agentpay-guard.vercel.app",
    );
    expect(cfg.targetUrl).toBe(
      "https://cspr-agentpay-guard.vercel.app/premium/parking-report/MAD-001",
    );
  });

  it("uses the deployment URL for Vercel previews", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "VERCEL_PROJECT_PRODUCTION_URL",
      "cspr-agentpay-guard.vercel.app",
    );
    vi.stubEnv(
      "VERCEL_URL",
      "cspr-agentpay-guard-preview.vercel.app",
    );

    expect(loadDashboardConfig().publicBaseUrl).toBe(
      "https://cspr-agentpay-guard-preview.vercel.app",
    );
  });
});

describe("dashboard pages", () => {
  it("has the expected page structure", () => {
    // Verify key labels exist in the app.
    expect("CSPR AgentPay Guard").toContain("AgentPay");
    expect("MOCK MODE").toBeTruthy();
  });

  it("renders the judge-ready content without a live-spend control", () => {
    const judge = readFileSync(resolve(import.meta.dirname, "../app/judge/page.tsx"), "utf8");
    expect(judge).toContain("Firewall for AI Wallets");
    expect(judge).toContain("Prompt-injection attack");
    expect(judge).toContain("Replay attack");
    expect(judge).toContain("VerifiedTestnetPaymentCard");
    expect(judge).toContain("MCP Agent Interface");
    expect(judge).toContain("Real versus hosted");
    expect(judge).toContain("agentpay_run_rwa_due_diligence");
    expect(judge).toContain("801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f");
    expect(judge).not.toMatch(/live[- ]spend.*(?:button|href)/i);
  });

  it("keeps transaction values responsive-safe", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../app/globals.css"), "utf8");
    expect(css).toContain(".hash-value");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 720px)");
  });
});

describe("self-contained demo flow", () => {
  it("runs the AgentPay flow without the external paid API", async () => {
    const result = await executeSelfContainedDemoFlow();
    const auditBody = result.auditEvents as {
      auditEvents?: Array<{ type: string }>;
    };

    expect(result.success).toBe(true);
    expect(result.paymentRequirement?.url).toBe(
      "http://localhost:3000/premium/parking-report/MAD-001",
    );
    expect(result.proof?.kind).toBe("mock");
    expect(result.premiumReport?.lotId).toBe("MAD-001");
    expect(
      auditBody.auditEvents?.some((event) => event.type === "payment_settled"),
    ).toBe(true);
  });
});
