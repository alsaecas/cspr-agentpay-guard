import { describe, expect, it } from "vitest";

import { loadAgentDemoConfig } from "../src/config";
import { runAgentDemo, type AgentDemoConfig } from "../src/demo";

// Each test uses a unique port to avoid conflicts.
let portCounter = 4100;

function testConfig(overrides?: Partial<AgentDemoConfig>): AgentDemoConfig {
  const port = portCounter++;
  return {
    mode: "mock",
    paidApiBaseUrl: `http://127.0.0.1:${port}`,
    agentId: "agent_research_001",
    policyId: "policy_demo_agent_001",
    targetUrl: `http://127.0.0.1:${port}/premium/parking-report/MAD-001`,
    autoStartPaidApi: true,
    autoSettle: true,
    demoPort: port,
    ...overrides,
  };
}

describe("agent demo config", () => {
  it("loads defaults", () => {
    const cfg = loadAgentDemoConfig({});
    expect(cfg.mode).toBe("mock");
    expect(cfg.agentId).toBe("agent_research_001");
    expect(cfg.autoStartPaidApi).toBe(true);
    expect(cfg.autoSettle).toBe(true);
    expect(cfg.demoPort).toBe(4000);
  });

  it("respects env overrides", () => {
    const cfg = loadAgentDemoConfig({
      AGENTPAY_AGENT_ID: "custom-agent",
      AGENTPAY_AUTO_START_PAID_API: "false",
      AGENTPAY_AUTO_SETTLE: "false",
      AGENTPAY_DEMO_PORT: "9999",
    });
    expect(cfg.agentId).toBe("custom-agent");
    expect(cfg.autoStartPaidApi).toBe(false);
    expect(cfg.autoSettle).toBe(false);
    expect(cfg.demoPort).toBe(9999);
  });
});

describe("agent demo", () => {
  it("runs self-contained and returns successful output", async () => {
    const result = await runAgentDemo(testConfig());

    const text = result.lines.join("\n");

    expect(result.success).toBe(true);
    expect(text).toContain("CSPR AgentPay Guard");
    expect(text).toContain("Autonomous Agent Demo");
    expect(text).toContain("MOCK MODE");
    expect(text).toContain("mock-escrowed-");
    expect(text).toContain("paymentId:");
    expect(text).toContain("responseHash:");
  });

  it("output contains HTTP 402 step", async () => {
    const result = await runAgentDemo(testConfig());
    expect(result.lines.join("\n")).toContain("402 PaymentRequirement");
  });

  it("output contains request-bound receipt step", async () => {
    const result = await runAgentDemo(testConfig());
    expect(result.lines.join("\n")).toContain("request-bound receipt");
  });

  it("output contains premium report values", async () => {
    const result = await runAgentDemo(testConfig());
    const text = result.lines.join("\n");
    expect(text).toContain("MAD-001");
    expect(text).toContain("revenue");
  });

  it("output contains mock proof label", async () => {
    const result = await runAgentDemo(testConfig());
    expect(result.lines.join("\n")).toContain("proof kind:  mock");
  });

  it("output contains settlement when autoSettle=true", async () => {
    const result = await runAgentDemo(testConfig({ autoSettle: true }));
    expect(result.lines.join("\n")).toContain("settlement:  settled");
  });

  it("autoSettle=false omits settlement", async () => {
    const result = await runAgentDemo(testConfig({ autoSettle: false }));
    const text = result.lines.join("\n");
    expect(result.success).toBe(true);
    expect(text).toContain("MOCK MODE");
    expect(text).not.toContain("settlement:  settled");
  });

  it("handles paid-api unreachable gracefully", async () => {
    const result = await runAgentDemo(
      testConfig({ autoStartPaidApi: false, paidApiBaseUrl: "http://127.0.0.1:19999" }),
    );
    expect(result.success).toBe(false);
    expect(result.lines.join("\n")).toContain("unreachable");
  });
});
