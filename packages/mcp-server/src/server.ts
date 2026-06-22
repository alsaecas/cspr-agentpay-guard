import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PaymentRequirementSchema } from "@cspr-agentpay/protocol";
import { z } from "zod";

import { PaidApiClient, PaidApiError, type PaidResourceResult } from "./client";
import { type McpServerConfig, loadMcpServerConfig } from "./config";

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
  const client = new PaidApiClient(cfg);

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
      const lines: string[] = [
        "CSPR AgentPay Guard MCP server is ready.",
        `mode=mock`,
        `paidApiBaseUrl=${cfg.paidApiBaseUrl}`,
      ];

      let reachable = true;
      try {
        await client.health();
      } catch {
        reachable = false;
        lines.push("⚠ paid-api is unreachable. Start it with: pnpm --filter @cspr-agentpay/paid-api dev");
      }

      lines.push("");

      const tools = [
        "agentpay_status — server status + paid-api health",
        "setup_demo — initialize demo merchant and policy",
        "call_paid_resource — full 402 → authorize → retry → premium data",
        "authorize_requirement — authorize + escrow a payment requirement",
        "settle_payment — settle a fulfilled payment",
        "get_audit_timeline — retrieve ordered audit events",
      ];

      lines.push("Available tools:");
      for (const tool of tools) {
        lines.push(`  • ${tool}`);
      }

      if (includeConfig) {
        lines.push("");
        lines.push("Config:");
        lines.push(`  transport: ${cfg.transport}`);
        lines.push(`  paidApiBaseUrl: ${cfg.paidApiBaseUrl}`);
        lines.push(`  defaultPolicyId: ${cfg.defaultPolicyId}`);
        lines.push(`  defaultAgentId: ${cfg.defaultAgentId}`);
        lines.push(`  autoSetup: ${cfg.autoSetup}`);
        lines.push(`  autoSettle: ${cfg.autoSettle}`);
      }

      if (!reachable) {
        lines.unshift("⚠ paid-api unreachable — demo tools will fail.");
      }

      return textResponse(lines.join("\n"));
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
        const result = await client.setupDemo();

        const summary = [
          "Demo state initialized.",
          `merchantId=${result.merchant.merchantId}`,
          `merchant=${result.merchant.displayName}`,
          `policyId=${result.policy.policyId}`,
          `agentId=${result.policy.agentId}`,
          `maxAmountPerPayment=${result.policy.maxAmountPerPayment}`,
          `totalBudget=${result.policy.totalBudget}`,
          `status=${result.policy.status}`,
          `expiresAt=${result.policy.expiresAt}`,
          `auditEvents=${result.auditEvents.length}`,
        ].join("\n");

        return jsonResponse({
          summary,
          merchant: result.merchant,
          policy: result.policy,
          auditEvents: result.auditEvents,
        });
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
    async ({ url, policyId, agentId, autoSetup, autoSettle }) => {
      const effectivePolicyId = policyId ?? cfg.defaultPolicyId;
      const effectiveAgentId = agentId ?? cfg.defaultAgentId;
      const shouldSetup = autoSetup ?? cfg.autoSetup;
      const shouldSettle = autoSettle ?? cfg.autoSettle;

      const timeline: string[] = [];

      try {
        // 1. Auto-setup
        if (shouldSetup) {
          try {
            await client.setupDemo();
            timeline.push("Demo state initialized (auto-setup).");
          } catch {
            timeline.push("Auto-setup skipped (paid-api may already be initialized).");
          }
        }

        // 2. Call the resource without receipt
        timeline.push("Called protected resource.");
        const firstResponse = await client.getPaidResource(url);

        // 3. Not 402 → return directly
        if (firstResponse.status === 200) {
          return jsonResponse({
            isPaid: false,
            message: "Resource returned 200 — no payment was required.",
            resource: firstResponse.body,
          });
        }

        if (firstResponse.status !== 402) {
          return errorResponse(
            `Expected 402 Payment Required but got ${firstResponse.status}. Body: ${JSON.stringify(firstResponse.body)}`,
          );
        }

        // 4. Parse PaymentRequirement
        timeline.push("Received HTTP 402 PaymentRequirement.");
        const paymentBody = firstResponse.body as Record<string, unknown> | null;
        const requirementRaw = paymentBody?.paymentRequirement;
        if (!requirementRaw) {
          return errorResponse("402 response did not contain a paymentRequirement field.");
        }

        let requirement;
        try {
          requirement = PaymentRequirementSchema.parse(requirementRaw);
        } catch {
          return errorResponse("402 response contains an invalid PaymentRequirement.");
        }

        // 5. Authorize and submit
        timeline.push("Authorized payment under policy.");
        const authResult = await client.authorizeRequirement({
          policyId: effectivePolicyId,
          agentId: effectiveAgentId,
          requirement,
        });

        timeline.push("Submitted mock Casper payment into escrow.");

        // 6. Retry with receipt
        timeline.push("Retried protected resource with request-bound receipt.");
        const retryResponse = await client.getPaidResource(url, authResult.receipt);

        if (retryResponse.status !== 200) {
          return errorResponse(
            `Retry with receipt failed (status ${retryResponse.status}). Body: ${JSON.stringify(retryResponse.body)}`,
          );
        }

        timeline.push("Received premium data.");
        timeline.push("Payment fulfilled.");

        const result: PaidResourceResult = {
          isPaid: true,
          resource: retryResponse.body,
          paymentRequirement: requirement,
          authorization: authResult.authorization,
          receipt: authResult.receipt,
          proof: authResult.proof,
          auditEvents: authResult.auditEvents,
        };

        // 7. Auto-settle
        if (shouldSettle && authResult.receipt.paymentId) {
          try {
            const settleResult = await client.settlePayment(authResult.receipt.paymentId);
            result.settlement = settleResult;
            timeline.push("Payment settled.");
          } catch (settleErr) {
            timeline.push(
              `Settlement failed: ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
            );
          }
        }

        return jsonResponse({
          ...result,
          timeline,
        });
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
        const parsed = PaymentRequirementSchema.parse(requirement);

        const result = await client.authorizeRequirement({
          policyId: policyId ?? cfg.defaultPolicyId,
          agentId: agentId ?? cfg.defaultAgentId,
          requirement: parsed,
        });

        return jsonResponse({
          authorization: result.authorization,
          receipt: result.receipt,
          proof: result.proof,
          updatedPolicy: result.updatedPolicy,
          auditEvents: result.auditEvents,
        });
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
        const result = await client.settlePayment(paymentId);

        return jsonResponse({
          paymentId: result.paymentId,
          status: result.status,
          payment: result.payment,
          auditEvents: result.auditEvents,
        });
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
        const events = await client.getAuditEvents(paymentId);

        const timeline = events.map((event) =>
          `[${event.createdAt}] ${event.type}${event.paymentId ? ` paymentId=${event.paymentId}` : ""} — ${event.message}`,
        );

        return jsonResponse({
          auditEvents: events,
          timeline,
          eventCount: events.length,
        });
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
// Direct execution (node packages/mcp-server/src/server.ts)
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1]
  ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  await startStdioServer();
}
