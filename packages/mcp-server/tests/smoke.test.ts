import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";

import {
  createPaidApiServer,
  type PaidApiConfig,
} from "@cspr-agentpay/paid-api";

import { PaidApiClient, PaidApiError } from "../src/client";
import { loadMcpServerConfig, type McpServerConfig } from "../src/config";
import { createAgentPayMcpServer } from "../src/server";

// ---------------------------------------------------------------------------
// In-process paid-api server on a known port
// ---------------------------------------------------------------------------

const PAID_API_PORT = 4010;
const paidApiBaseUrl = `http://127.0.0.1:${PAID_API_PORT}`;

const paidApiConfig: PaidApiConfig = {
  mode: "mock",
  agentId: "agent_research_001",
  merchantId: "merchant_market_data_001",
  merchantAccount: "mock-merchant-account",
  policyId: "policy_demo_agent_001",
  port: PAID_API_PORT,
};

let httpServer: Server;

beforeAll(async () => {
  const app = createPaidApiServer(paidApiConfig);
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(PAID_API_PORT, resolve));
});

afterAll(() => {
  httpServer.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mcpConfig(overrides?: Partial<McpServerConfig>): McpServerConfig {
  return {
    ...loadMcpServerConfig({}),
    paidApiBaseUrl,
    autoSetup: false,
    autoSettle: false,
    ...overrides,
  };
}

function client(overrides?: Partial<McpServerConfig>): PaidApiClient {
  return new PaidApiClient(mcpConfig(overrides));
}

// ---------------------------------------------------------------------------
// Tests: Config
// ---------------------------------------------------------------------------

describe("McpServerConfig", () => {
  it("loads defaults", () => {
    const cfg = loadMcpServerConfig({});
    expect(cfg.transport).toBe("stdio");
    expect(cfg.paidApiBaseUrl).toBe("http://127.0.0.1:4000");
    expect(cfg.defaultPolicyId).toBe("policy_demo_agent_001");
    expect(cfg.autoSetup).toBe(true);
    expect(cfg.autoSettle).toBe(false);
  });

  it("respects env overrides", () => {
    const cfg = loadMcpServerConfig({
      AGENTPAY_MCP_TRANSPORT: "streamable-http",
      AGENTPAY_PAID_API_BASE_URL: "http://custom:9999",
      AGENTPAY_AUTO_SETUP: "false",
      AGENTPAY_AUTO_SETTLE: "true",
    });
    expect(cfg.transport).toBe("streamable-http");
    expect(cfg.paidApiBaseUrl).toBe("http://custom:9999");
    expect(cfg.autoSetup).toBe(false);
    expect(cfg.autoSettle).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: PaidApiClient (the MCP server's business logic)
// ---------------------------------------------------------------------------

describe("PaidApiClient", () => {
  it("health returns ok", async () => {
    const health = await client().health();
    expect(health.ok).toBe(true);
    expect(health.mode).toBe("mock");
  });

  it("setupDemo creates merchant and policy", async () => {
    const result = await client().setupDemo();
    expect(result.merchant.merchantId).toBe(paidApiConfig.merchantId);
    expect(result.policy.policyId).toBe(paidApiConfig.policyId);
    expect(result.auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("getPaidResource returns 402 without receipt", async () => {
    await client().setupDemo();
    const res = await client().getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    expect(res.status).toBe(402);
    const body = res.body as Record<string, unknown>;
    expect(body.error).toBe("PAYMENT_REQUIRED");
  });

  it("full 402 → authorize → retry returns 200", async () => {
    const c = client();
    await c.setupDemo();

    const res402 = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    expect(res402.status).toBe(402);
    const body = res402.body as Record<string, unknown>;

    const auth = await c.authorizeRequirement({
      policyId: paidApiConfig.policyId,
      agentId: paidApiConfig.agentId,
      requirement: body.paymentRequirement as any,
    });
    expect(auth.receipt.status).toBe("escrowed");
    expect(auth.receipt.proof.kind).toBe("mock");

    const retry = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
      auth.receipt,
    );
    expect(retry.status).toBe(200);
    const premium = retry.body as Record<string, unknown>;
    expect(premium.lotId).toBe("MAD-001");
    expect(premium.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("authorizeRequirement returns escrowed receipt with valid proof", async () => {
    const c = client();
    await c.setupDemo();
    const res402 = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    const body = res402.body as Record<string, unknown>;

    const auth = await c.authorizeRequirement({
      policyId: paidApiConfig.policyId,
      agentId: paidApiConfig.agentId,
      requirement: body.paymentRequirement as any,
    });

    expect(auth.receipt.status).toBe("escrowed");
    expect(auth.receipt.paymentId).toMatch(/^[a-f0-9]{64}$/);
    expect(auth.proof.kind).toBe("mock");
    expect(auth.updatedPolicy.spentAmount).toBe("1000000000");
    expect(Array.isArray(auth.auditEvents)).toBe(true);
  });

  it("settlePayment returns settled after fulfilled", async () => {
    const c = client();
    await c.setupDemo();
    const res402 = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    const body = res402.body as Record<string, unknown>;
    const auth = await c.authorizeRequirement({
      policyId: paidApiConfig.policyId,
      agentId: paidApiConfig.agentId,
      requirement: body.paymentRequirement as any,
    });

    // Fulfill first.
    await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
      auth.receipt,
    );

    const settle = await c.settlePayment(auth.receipt.paymentId);
    expect(settle.status).toBe("settled");
    expect(settle.payment?.status).toBe("settled");
  });

  it("getAuditEvents returns ordered events", async () => {
    const c = client();
    await c.setupDemo();
    const events = await c.getAuditEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    const types = events.map((e) => e.type);
    expect(types).toContain("merchant_registered");
    expect(types).toContain("policy_created");
  });

  it("getAuditEvents filters by paymentId", async () => {
    const c = client();
    await c.setupDemo();
    const res402 = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    const body = res402.body as Record<string, unknown>;
    const auth = await c.authorizeRequirement({
      policyId: paidApiConfig.policyId,
      agentId: paidApiConfig.agentId,
      requirement: body.paymentRequirement as any,
    });

    const filtered = await c.getAuditEvents(auth.receipt.paymentId);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    for (const event of filtered) {
      expect(event.paymentId).toBe(auth.receipt.paymentId);
    }
  });

  it("unreachable host throws PaidApiError", async () => {
    const bad = new PaidApiClient(mcpConfig({ paidApiBaseUrl: "http://127.0.0.1:19999" }));
    await expect(bad.health()).rejects.toThrow(PaidApiError);
  });

  it("cross-lotId receipt is rejected by paid-api", async () => {
    const c = client();
    await c.setupDemo();

    // Get receipt for MAD-001.
    const res402 = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/MAD-001`,
    );
    const body = res402.body as Record<string, unknown>;
    const auth = await c.authorizeRequirement({
      policyId: paidApiConfig.policyId,
      agentId: paidApiConfig.agentId,
      requirement: body.paymentRequirement as any,
    });

    // Try using MAD-001 receipt on BCN-001 — must fail.
    const badRetry = await c.getPaidResource(
      `${paidApiBaseUrl}/premium/parking-report/BCN-001`,
      auth.receipt,
    );
    expect(badRetry.status).toBe(403);
    const errBody = badRetry.body as Record<string, unknown>;
    expect(errBody.error).toBe("REQUEST_HASH_MISMATCH");
  });
});

// ---------------------------------------------------------------------------
// Tests: MCP Server creation (smoke)
// ---------------------------------------------------------------------------

describe("McpServer", () => {
  it("creates a server instance", () => {
    const server = createAgentPayMcpServer(mcpConfig());
    expect(server).toBeTruthy();
  });

  it("startStdioServer is callable", async () => {
    const { startStdioServer } = await import("../src/server");
    expect(typeof startStdioServer).toBe("function");
  });
});
