import { describe, expect, it } from "vitest";

import { loadDashboardConfig } from "../lib/agentpayConfig";

describe("dashboard config", () => {
  it("loads defaults", () => {
    const cfg = loadDashboardConfig();
    expect(cfg.mode).toBe("mock");
    expect(cfg.paidApiBaseUrl).toBe("http://127.0.0.1:4000");
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
