import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createCasperPaymentAdapter } from "@cspr-agentpay/casper-adapter";

export function createAgentPayMcpServer() {
  const server = new McpServer({
    name: "cspr-agentpay-guard",
    version: "0.1.0",
  });

  server.registerTool(
    "agentpay_mock_status",
    {
      title: "AgentPay Mock Status",
      description:
        "Reports the configured CSPR AgentPay Guard mode for agent demos.",
      inputSchema: {
        includeAdapter: z.boolean().default(true),
      },
    },
    async ({ includeAdapter }) => {
      const adapter = createCasperPaymentAdapter();
      const lines = [
        "CSPR AgentPay Guard MCP server is ready.",
        `mode=${adapter.mode}`,
      ];
      if (includeAdapter) {
        lines.push("adapter=CasperPaymentAdapter");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );

  return server;
}

export async function startStdioServer() {
  const server = createAgentPayMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  await startStdioServer();
}
