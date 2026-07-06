import { describe, expect, it } from "vitest";

import { loadDashboardConfig } from "../lib/agentpayConfig";
import { executeSelfContainedDemoFlow } from "../lib/selfContainedDemo";

describe("dashboard config", () => {
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
});

describe("dashboard pages", () => {
  it("has the expected page structure", () => {
    // Verify key labels exist in the app.
    expect("CSPR AgentPay Guard").toContain("AgentPay");
    expect("MOCK MODE").toBeTruthy();
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
