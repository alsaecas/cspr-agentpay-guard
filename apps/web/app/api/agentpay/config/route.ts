import { loadDashboardConfig } from "@/lib/agentpayConfig";
import { NextResponse } from "next/server";

export async function GET() {
  const cfg = loadDashboardConfig();
  return NextResponse.json({
    mode: cfg.mode,
    paidApiBaseUrl: cfg.paidApiBaseUrl,
    targetUrl: cfg.targetUrl,
    defaultPolicyId: cfg.defaultPolicyId,
    defaultAgentId: cfg.defaultAgentId,
    autoSettle: cfg.autoSettle,
  });
}
