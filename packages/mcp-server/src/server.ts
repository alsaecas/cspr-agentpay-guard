import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { PaidApiError } from "./client";
import { type McpServerConfig, loadMcpServerConfig } from "./config";
import {
  authorizeRequirementHandler,
  callPaidResourceHandler,
  getAgentPayStatusHandler,
  getAuditTimelineHandler,
  settlePaymentHandler,
  setupDemoHandler,
} from "./toolHandlers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function jsonResponse(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResponse(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createAgentPayMcpServer(config?: McpServerConfig) {
  const cfg = config ?? loadMcpServerConfig();

  const server = new McpServer({
    name: "cspr-agentpay-guard",
    version: "0.2.0",
  });

  // -----------------------------------------------------------------------
  // Tool: agentpay_status
  // -----------------------------------------------------------------------

  server.registerTool(
    "agentpay_status",
    {
      title: "AgentPay Guard Status",
      description:
        "Report CSPR AgentPay Guard mode, config, and available tools. Optionally checks if the paid API is reachable.",
      inputSchema: {
        includeConfig: z.boolean().default(false),
      },
    },
    async ({ includeConfig }) => {
      try {
        const status = await getAgentPayStatusHandler(cfg, includeConfig);

        const lines: string[] = [
          "CSPR AgentPay Guard MCP server is ready.",
          `mode=mock`,
          `paidApiBaseUrl=${cfg.paidApiBaseUrl}`,
        ];

        if (!status.reachable) {
          lines.unshift("⚠ paid-api unreachable — demo tools will fail.");
          lines.push("⚠ paid-api is unreachable. Start it with: pnpm --filter @cspr-agentpay/paid-api dev");
        }

        lines.push("");
        lines.push("Available tools:");
        for (const tool of status.tools) {
          lines.push(`  • ${tool}`);
        }

        if (includeConfig) {
          lines.push("");
          lines.push("Config:");
          for (const [key, value] of Object.entries(status.config ?? {})) {
            lines.push(`  ${key}: ${value}`);
          }
        }

        return textResponse(lines.join("\n"));
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // -----------------------------------------------------------------------
  // Tool: setup_demo
  // -----------------------------------------------------------------------

  server.registerTool(
    "setup_demo",
    {
      title: "Setup Demo State",
      description:
        "Initialize or reset the paid API demo state (merchant + policy). Call this before using other tools.",
      inputSchema: {
        reset: z.boolean().default(true).describe("Reset demo state (always resets for now)."),
      },
    },
    async () => {
      try {
        const result = await setupDemoHandler(cfg);

        const summary = [
          "Demo state initialized.",
          `merchantId=${result.merchantId}`,
          `merchant=${result.displayName}`,
          `policyId=${result.policyId}`,
          `agentId=${result.agentId}`,
          `maxAmountPerPayment=${result.maxAmountPerPayment}`,
          `totalBudget=${result.totalBudget}`,
          `status=${result.status}`,
          `expiresAt=${result.expiresAt}`,
          `auditEvents=${result.auditEventCount}`,
        ].join("\n");

        return jsonResponse({ summary, ...result });
      } catch (err) {
        return errorResponse(
          `Failed to setup demo: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  // -----------------------------------------------------------------------
  // Tool: call_paid_resource
  // -----------------------------------------------------------------------

  server.registerTool(
    "call_paid_resource",
    {
      title: "Call Paid Resource",
      description:
        "Call a protected HTTP 402 resource. If payment is required, automatically authorizes and retries with a receipt. Returns premium data, payment proof, and audit timeline.",
      inputSchema: {
        url: z.string().url().describe("The protected resource URL to call."),
        method: z.string().default("GET").describe("HTTP method (GET only for now)."),
        policyId: z.string().optional().describe("Policy ID (defaults to config)."),
        agentId: z.string().optional().describe("Agent ID (defaults to config)."),
        autoSetup: z.boolean().optional().describe("Auto-setup demo state before calling."),
        autoSettle: z.boolean().optional().describe("Auto-settle payment after receiving data."),
      },
    },
    async (input) => {
      try {
        const result = await callPaidResourceHandler(
          {
            url: input.url,
            method: input.method,
            policyId: input.policyId ?? undefined,
            agentId: input.agentId ?? undefined,
            autoSetup: input.autoSetup ?? undefined,
            autoSettle: input.autoSettle ?? undefined,
          },
          cfg,
        );
        return jsonResponse(result);
      } catch (err) {
        const message = err instanceof PaidApiError
          ? `${err.message}. Body: ${JSON.stringify(err.body)}`
          : err instanceof Error
            ? err.message
            : String(err);
        return errorResponse(message);
      }
    },
  );

  // -----------------------------------------------------------------------
  // Tool: authorize_requirement
  // -----------------------------------------------------------------------

  server.registerTool(
    "authorize_requirement",
    {
      title: "Authorize Payment Requirement",
      description:
        "Authorize and escrow a PaymentRequirement returned by a protected resource. Returns an escrowed receipt for use with X-AgentPay-Receipt.",
      inputSchema: {
        requirement: z.record(z.string(), z.unknown()).describe("The PaymentRequirement object from a 402 response."),
        policyId: z.string().optional().describe("Policy ID (defaults to config)."),
        agentId: z.string().optional().describe("Agent ID (defaults to config)."),
      },
    },
    async ({ requirement, policyId, agentId }) => {
      try {
        const result = await authorizeRequirementHandler(
          {
            requirement,
            policyId: policyId ?? undefined,
            agentId: agentId ?? undefined,
          },
          cfg,
        );
        return jsonResponse(result);
      } catch (err) {
        return errorResponse(
          `Authorization failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  // -----------------------------------------------------------------------
  // Tool: settle_payment
  // -----------------------------------------------------------------------

  server.registerTool(
    "settle_payment",
    {
      title: "Settle Payment",
      description:
        "Settle a fulfilled payment by paymentId. The payment must be in 'fulfilled' status.",
      inputSchema: {
        paymentId: z.string().describe("The paymentId to settle."),
      },
    },
    async ({ paymentId }) => {
      try {
        const result = await settlePaymentHandler(paymentId, cfg);
        return jsonResponse(result);
      } catch (err) {
        const message = err instanceof PaidApiError
          ? `${err.message}. Body: ${JSON.stringify(err.body)}`
          : err instanceof Error
            ? err.message
            : String(err);
        return errorResponse(`Settlement failed: ${message}`);
      }
    },
  );

  // -----------------------------------------------------------------------
  // Tool: get_audit_timeline
  // -----------------------------------------------------------------------

  server.registerTool(
    "get_audit_timeline",
    {
      title: "Get Audit Timeline",
      description:
        "Retrieve the ordered audit event timeline, optionally filtered by paymentId.",
      inputSchema: {
        paymentId: z.string().optional().describe("Filter events by paymentId."),
      },
    },
    async ({ paymentId }) => {
      try {
        const result = await getAuditTimelineHandler(cfg, paymentId);
        return jsonResponse(result);
      } catch (err) {
        return errorResponse(
          `Failed to retrieve audit events: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------

export async function startStdioServer(config?: McpServerConfig) {
  const server = createAgentPayMcpServer(config);
  const transport = new StdioServerTransport(process.stdin, process.stdout);
  await server.connect(transport);
}

// ---------------------------------------------------------------------------
// Direct execution
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  await startStdioServer();
}
