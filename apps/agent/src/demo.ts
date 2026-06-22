import { loadMcpServerConfig } from "@cspr-agentpay/mcp-server";
import type { PaidApiConfig } from "@cspr-agentpay/paid-api";

import type { AgentDemoConfig } from "./config";

// Re-export to allow reuse.
export { loadAgentDemoConfig } from "./config";
export type { AgentDemoConfig } from "./config";

// ---------------------------------------------------------------------------
// Demo runner
// ---------------------------------------------------------------------------

export interface AgentDemoOutput {
  /** Lines of terminal output, one per section. */
  lines: string[];
  /** Whether the demo completed without fatal errors. */
  success: boolean;
  /** Error message if the demo failed. */
  error?: string;
}

export async function runAgentDemo(config: AgentDemoConfig): Promise<AgentDemoOutput> {
  const lines: string[] = [];
  let success = true;

  const add = (...args: string[]) => lines.push(...args);
  const separator = () => add("─".repeat(72));

  // -----------------------------------------------------------------------
  // Header
  // -----------------------------------------------------------------------
  add("");
  add("╔══════════════════════════════════════════════════════════════════════╗");
  add("║         CSPR AgentPay Guard — Autonomous Agent Demo                ║");
  add("╚══════════════════════════════════════════════════════════════════════╝");
  add("");

  add("Objective:");
  add('  "Evaluate whether parking lot MAD-001 is worth further RWA due diligence."');
  add("");

  add("Policy:");
  add(`  Agent:     ${config.agentId}`);
  add(`  Policy:    ${config.policyId}`);
  add(`  Auto-settle: ${config.autoSettle}`);
  add(`  Mode:      ${config.mode}`);
  add("");

  // -----------------------------------------------------------------------
  // Timeline
  // -----------------------------------------------------------------------
  add("Timeline:");
  add("");

  let step = 0;
  const timelineStep = (text: string) => {
    step += 1;
    add(`  ${step}. ${text}`);
  };

  // Start paid-api if self-contained.
  let paidApiServer: { close: () => void } | null = null;
  let actualBaseUrl = config.paidApiBaseUrl;

  if (config.autoStartPaidApi) {
    try {
      const { createPaidApiServer } = await import("@cspr-agentpay/paid-api");
      const { createServer } = await import("node:http");

      const paidCfg: PaidApiConfig = {
        mode: "mock",
        agentId: config.agentId,
        merchantId: "merchant_market_data_001",
        merchantAccount: "mock-merchant-account",
        policyId: config.policyId,
        port: config.demoPort,
      };

      const app = createPaidApiServer(paidCfg);
      const httpServer = createServer(app);

      await new Promise<void>((resolve) => httpServer.listen(config.demoPort, resolve));

      actualBaseUrl = `http://127.0.0.1:${config.demoPort}`;
      paidApiServer = { close: () => httpServer.close() };

      timelineStep("Paid API started in-process on port " + config.demoPort + ".");
    } catch (err) {
      add("  ✗ Failed to start paid-api in-process.");
      add(`    ${err instanceof Error ? err.message : String(err)}`);
      add(`    Start it manually: pnpm --filter @cspr-agentpay/paid-api dev`);
      if (paidApiServer) paidApiServer.close();
      return { lines, success: false, error: "paid-api startup failed" };
    }
  }

  try {
    // -------------------------------------------------------------------
    // MCP tool handler flow
    // -------------------------------------------------------------------
    const { callPaidResourceHandler, setupDemoHandler } = await import(
      "@cspr-agentpay/mcp-server"
    );

    const mcpCfg = loadMcpServerConfig({
      AGENTPAY_PAID_API_BASE_URL: actualBaseUrl,
      AGENTPAY_DEFAULT_POLICY_ID: config.policyId,
      AGENTPAY_DEFAULT_AGENT_ID: config.agentId,
      AGENTPAY_AUTO_SETUP: "false", // we call setup explicitly below
      AGENTPAY_AUTO_SETTLE: config.autoSettle ? "true" : "false",
    });

    // 1. Check paid-api health with retry.
    timelineStep("Agent starts with objective: fetch premium parking report.");

    let healthOk = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`${actualBaseUrl}/health`);
        if (res.ok) {
          healthOk = true;
          break;
        }
      } catch {
        // Retry with delay.
      }
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!healthOk) {
      add("");
      add("  ✗ Paid API is unreachable.");
      add(`    Expected at: ${actualBaseUrl}/health`);
      add(`    Start it with: pnpm --filter @cspr-agentpay/paid-api dev`);
      if (paidApiServer) paidApiServer.close();
      return { lines, success: false, error: "paid-api unreachable" };
    }

    // 2. Setup demo state.
    await setupDemoHandler(mcpCfg);
    timelineStep("Demo merchant and policy registered.");

    // 3. Call paid resource.
    const targetUrl = config.targetUrl.replace(
      /^http:\/\/127\.0\.0\.1:\d+/,
      actualBaseUrl.replace(/\/$/, ""),
    );

    timelineStep("Agent calls protected resource.");

    const result = await callPaidResourceHandler(
      {
        url: targetUrl,
        autoSetup: false,
        autoSettle: config.autoSettle,
        policyId: config.policyId,
        agentId: config.agentId,
      },
      mcpCfg,
    );

    if (!result.isPaid) {
      add("  Resource returned 200 — no payment was required.");
      if (paidApiServer) paidApiServer.close();
      return { lines, success: true };
    }

    // 4. Print the detailed timeline.
    separator();
    add("");

    for (let i = 4; i <= result.timeline.length + 3; i++) {
      const t = result.timeline[i - 4];
      if (t) add(`  ${i}. ${t}`);
    }

    add("");
    separator();
    add("");

    // 5. Recommendation.
    const resource = result.resource as Record<string, unknown> | undefined;

    add("Agent recommendation:");
    if (resource) {
      const revenue = resource.revenue24h ?? "unknown";
      const occupancy = resource.occupancyRate ?? "unknown";
      const ticket = resource.avgTicketSize ?? "unknown";
      const confidence = resource.confidenceScore ?? "unknown";

      add(
        `  Based on 24h revenue of ${revenue}, ${typeof occupancy === "number" ? Math.round(Number(occupancy) * 100) + "%" : "unknown"} occupancy,`,
      );
      add(
        `  average ticket size of ${ticket}, and confidence score of ${confidence},`,
      );
      add(
        `  the agent recommends further due diligence. This is not investment`,
      );
      add(`  advice; it is a demo of controlled agent spending.`);
    }
    add("");

    // 6. Payment summary.
    const receipt = result.receipt as Record<string, unknown> | undefined;
    const proof = result.proof as Record<string, unknown> | undefined;

    add("Payment summary:");
    if (receipt) {
      add(`  paymentId:   ${receipt.paymentId}`);
    }
    if (proof) {
      add(`  proof kind:  ${proof.kind}`);
      add(`  proof hash:  ${proof.hash ?? proof.transactionHash ?? proof.deployHash}`);
    }
    if (resource) {
      add(`  responseHash: ${resource.responseHash}`);
    }
    if (result.settlement) {
      add(`  settlement:  ${result.settlement.status}`);
    }
    add("");

    add("══════════════════════════════════════════════════════════════════");
    add("  MOCK MODE — no real Casper funds were moved.");
    add("  All proofs use deterministic local mock-* hashes.");
    add("══════════════════════════════════════════════════════════════════");
    add("");

    // 7. Audit trail.
    const eventCount = Array.isArray(result.auditEvents) ? result.auditEvents.length : 0;
    add("Audit trail (last " + eventCount + " events):");
    if (result.timeline.length > 0) {
      add("");
      // Print the handler-level timeline as the audit trail.
      for (const line of result.timeline) {
        add(`  • ${line}`);
      }
    }
    add("");

    add("Demo complete.");
  } catch (err) {
    add("");
    add("  ✗ Demo failed.");
    add(`    ${err instanceof Error ? err.message : String(err)}`);
    success = false;
  }

  if (paidApiServer) {
    paidApiServer.close();
  }

  return { lines, success };
}
