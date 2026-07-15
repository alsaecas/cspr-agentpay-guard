import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createAgentPayMcpServer } from "../src/server";

function readJson(result: Awaited<ReturnType<Client["callTool"]>>) {
  const content = result.content[0];
  expect(content?.type).toBe("text");
  if (!content || content.type !== "text") throw new Error("missing tool JSON");
  return JSON.parse(content.text) as Record<string, unknown>;
}

describe("MCP judge protocol", () => {
  let client: Client;
  let server: ReturnType<typeof createAgentPayMcpServer>;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "judge-integration-test", version: "1.0.0" });
    server = createAgentPayMcpServer();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it("discovers the first-class judge tools through MCP", async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining([
      "agentpay_run_rwa_due_diligence",
      "agentpay_evaluate_payment",
      "agentpay_get_verified_testnet_payment",
      "agentpay_security_model",
    ]));
  });

  it("runs MAD-001 and an allowed evaluation without a signer or submitter", async () => {
    const rwa = readJson(await client.callTool({
      name: "agentpay_run_rwa_due_diligence", arguments: {},
    }));
    const allowed = readJson(await client.callTool({
      name: "agentpay_evaluate_payment",
      arguments: { scenario: "allowed-payment" },
    }));
    expect(rwa.decision).toBe("ALLOW");
    expect(rwa.signerCalled).toBe(false);
    expect(rwa.submitterCalled).toBe(false);
    expect(rwa.premiumResourceReleased).toBe(true);
    expect(allowed.reasonCode).toBe("POLICY_ALLOW");
    expect(allowed.signerCalled).toBe(false);
    expect(allowed.submissionCalled).toBe(false);
  });

  it.each([
    ["prompt-injection-payee-substitution", "PAYEE_MISMATCH"],
    ["replay-attempt", "TRANSACTION_REPLAYED"],
  ])("denies %s before signing", async (scenario, reasonCode) => {
    const result = readJson(await client.callTool({
      name: "agentpay_evaluate_payment", arguments: { scenario },
    }));
    expect(result.decision).toBe("DENY");
    expect(result.reasonCode).toBe(reasonCode);
    expect(result.signerCalled).toBe(false);
    expect(result.submissionCalled).toBe(false);
    expect(result.budgetDeltaMotes).toBe("0");
  });

  it("returns public verified evidence and no secret-shaped fields", async () => {
    const result = readJson(await client.callTool({
      name: "agentpay_get_verified_testnet_payment", arguments: {},
    }));
    expect(result.transactionHash).toBe(
      "801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f",
    );
    expect(result.executionStatus).toBe("succeeded");
    expect(result.paymentResponseVerified).toBe(true);
    expect(result.premiumResourceReleased).toBe(true);
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
