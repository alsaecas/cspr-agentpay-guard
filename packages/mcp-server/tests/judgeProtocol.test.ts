import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { createAgentPayMcpServer } from "../src/server";
import { loadMcpServerConfig } from "../src/config";

function readJson(result: Awaited<ReturnType<Client["callTool"]>>) {
  const validated = CallToolResultSchema.parse(result);
  const content = validated.content[0];
  expect(content?.type).toBe("text");
  if (!content || content.type !== "text") throw new Error("missing tool JSON");
  return JSON.parse(content.text) as Record<string, any>;
}

describe("MCP judge protocol", () => {
  let client: Client;
  let server: ReturnType<typeof createAgentPayMcpServer>;

  beforeEach(async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    client = new Client({ name: "judge-integration-test", version: "1.0.0" });
    server = createAgentPayMcpServer(
      loadMcpServerConfig({
        AGENTPAY_PAID_API_BASE_URL: "http://127.0.0.1:19998",
        AGENTPAY_AUTO_SETUP: "false",
      }),
    );
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  async function evaluate(scenario: string) {
    return readJson(
      await client.callTool({
        name: "agentpay_evaluate_payment",
        arguments: { scenario },
      }),
    );
  }

  it("discovers the first-class judge tools through MCP", async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "agentpay_run_rwa_due_diligence",
        "agentpay_evaluate_payment",
        "agentpay_get_verified_testnet_payment",
        "agentpay_security_model",
      ]),
    );
  });

  it("keeps judge tools available when the legacy paid API is offline", async () => {
    const result = await client.callTool({
      name: "agentpay_status",
      arguments: { includeConfig: false },
    });
    const validated = CallToolResultSchema.parse(result);
    const content = validated.content[0];
    expect(content?.type).toBe("text");
    if (!content || content.type !== "text") throw new Error("missing status text");
    expect(content.text).toContain("First-class judge tools remain available");
    expect(content.text).toContain("only legacy API-backed demo tools are unavailable");
    expect(content.text).not.toContain("demo tools will fail");
  });

  it("runs the real guarded MAD-001 flow with a no-spend adapter", async () => {
    const rwa = readJson(
      await client.callTool({
        name: "agentpay_run_rwa_due_diligence",
        arguments: {},
      }),
    );
    expect(rwa.decision).toBe("ALLOW");
    expect(rwa.orderedPolicyChecks.map((check: any) => check.check)).toEqual([
      "policy_active",
      "policy_signature",
      "network",
      "asset",
      "payee_integrity",
      "payee",
      "merchant",
      "resource",
      "amount_integrity",
      "amount",
      "budget",
      "expiry",
      "body_hash",
      "request_hash",
      "nonce",
      "facilitator",
    ]);
    expect(rwa.settlementAdapterCalled).toBe(true);
    expect(rwa.mockAuthorizationCalled).toBe(true);
    expect(rwa.signerCalled).toBe(false);
    expect(rwa.submissionCalled).toBe(false);
    expect(rwa.demoPremiumResourceReleased).toBe(true);
    expect(rwa.demoPremiumResponse.assetId).toBe("MAD-001");
    expect(rwa.verifiedTestnetPremiumResourceReleased).toBe(true);
    expect(rwa.mode).toBe("mock-no-spend");
  });

  it.each([
    ["prompt-injection-payee-substitution", "PAYEE_MISMATCH", "payee_integrity"],
    ["amount-escalation", "AMOUNT_EXCEEDS_PAYMENT_LIMIT", "amount"],
    ["resource-substitution", "RESOURCE_NOT_ALLOWED", "resource"],
    ["expired-requirement", "REQUIREMENT_EXPIRED", "expiry"],
    ["replay-attempt", "NONCE_ALREADY_USED", "nonce"],
  ])("uses the actual guard for %s", async (scenario, reasonCode, failedCheck) => {
    const result = await evaluate(scenario);
    expect(result.decision).toBe("DENY");
    expect(result.reasonCode).toBe(reasonCode);
    expect(result.orderedChecks.at(-1)).toMatchObject({
      check: failedCheck,
      passed: false,
      reason: reasonCode,
    });
    expect(result.settlementAdapterCalled).toBe(false);
    expect(result.adapterCalls.authorize).toBe(0);
    expect(result.adapterCalls.settle).toBe(0);
    expect(result.adapterCalls.verify).toBe(0);
    expect(result.signerCalled).toBe(false);
    expect(result.submissionCalled).toBe(false);
    expect(result.budgetDeltaMotes).toBe("0");
    expect(result.demoPremiumResponse).toBeUndefined();
    expect(result.demoPremiumResourceReleased).toBe(false);
  });

  it("distinguishes the tagged payee from its derived account hash", async () => {
    const allowed = await evaluate("allowed-payment");
    expect(allowed.expectedPayee).toBe(
      "01e16a6a8992000821589fc26d00bc63c1c06e636765e27bba3b8df99f302c8ec6",
    );
    expect(allowed.expectedPayeeAccountHash).toBe(
      "40ccfcd1c883b9b6241dc73dba2c13e852b9ea859bc50c244dbb940f63f297b4",
    );
    expect(allowed.requestedPayee).toBe(allowed.expectedPayee);
  });

  it("returns read-only public evidence with no secret-shaped fields", async () => {
    const result = readJson(
      await client.callTool({
        name: "agentpay_get_verified_testnet_payment",
        arguments: {},
      }),
    );
    expect(result.transactionHash).toBe(
      "801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f",
    );
    expect(result.executionStatus).toBe("succeeded");
    expect(result.paymentResponseVerified).toBe(true);
    expect(result.verifiedTestnetPremiumResourceReleased).toBe(true);
    expect(result.payee).not.toBe(result.payeeAccountHash);
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toMatch(/private.?key|pem|\.agentpay|signature/);
  });

  it("rejects invalid scenario input at the MCP schema boundary", async () => {
    const result = await client.callTool({
      name: "agentpay_evaluate_payment",
      arguments: { scenario: "send-real-money" },
    });
    expect(result.isError).toBe(true);
  });
});
