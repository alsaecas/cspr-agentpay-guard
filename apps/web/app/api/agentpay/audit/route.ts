import { loadDashboardConfig } from "@/lib/agentpayConfig";
import { listSelfContainedAuditEvents } from "@/lib/selfContainedDemo";
import { NextResponse } from "next/server";

export async function GET() {
  const cfg = loadDashboardConfig();

  if (cfg.demoBackend === "self-contained") {
    const auditEvents = await listSelfContainedAuditEvents();
    return NextResponse.json({
      auditEvents,
      backend: cfg.demoBackend,
    });
  }

  try {
    const res = await fetch(`${cfg.paidApiBaseUrl}/demo/audit`);
    const body = await res.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      {
        error: "UNREACHABLE",
        message:
          "Paid API is unreachable. Start it with: pnpm --filter @cspr-agentpay/paid-api dev",
      },
      { status: 503 },
    );
  }
}
