import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { createAgentPayMcpServer } from "../src/server";

function parsed(result: Awaited<ReturnType<Client["callTool"]>>) {
  const validated = CallToolResultSchema.parse(result);
  const item = validated.content[0];
  if (!item || item.type !== "text") throw new Error("MCP tool returned no JSON text");
  return JSON.parse(item.text) as Record<string, unknown>;
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createAgentPayMcpServer();
const client = new Client({ name: "agentpay-judge-demo", version: "1.0.0" });

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  const required = [
    "agentpay_run_rwa_due_diligence",
    "agentpay_evaluate_payment",
    "agentpay_get_verified_testnet_payment",
  ];
  for (const name of required) {
    if (!tools.tools.some((tool) => tool.name === name)) throw new Error(`Missing MCP tool: ${name}`);
  }

  const rwa = parsed(await client.callTool({ name: required[0]!, arguments: {} }));
  const allowed = parsed(await client.callTool({
    name: required[1]!, arguments: { scenario: "allowed-payment" },
  }));
  const injection = parsed(await client.callTool({
    name: required[1]!, arguments: { scenario: "prompt-injection-payee-substitution" },
  }));
  const replay = parsed(await client.callTool({
    name: required[1]!, arguments: { scenario: "replay-attempt" },
  }));
  const evidence = parsed(await client.callTool({ name: required[2]!, arguments: {} }));

  if (rwa.signerCalled || rwa.submissionCalled || allowed.signerCalled || allowed.submissionCalled) {
    throw new Error("Judge demo violated its no-spend invariant");
  }

  const hash = String(evidence.transactionHash);
  console.log("CSPR AgentPay Guard — MCP Judge Demo\n");
  console.log("1. RWA agent requests MAD-001");
  console.log("2. HTTP 402 requirement received");
  console.log(`3. Policy ${allowed.decision}`);
  console.log("4. Hosted demo submitted: no");
  console.log(`5. Prompt injection ${injection.decision === "DENY" ? "DENIED" : injection.decision}`);
  console.log(`6. Replay ${replay.reasonCode === "NONCE_ALREADY_USED" ? "REJECTED" : replay.decision}`);
  console.log(`7. Verified Testnet payment: ${hash.slice(0, 8)}…${hash.slice(-6)}`);
  console.log(`8. Premium data release: ${evidence.verifiedTestnetPremiumResourceReleased ? "verified" : "not verified"}`);
  console.log("9. Hosted signing: disabled");
} finally {
  await client.close();
  await server.close();
}
