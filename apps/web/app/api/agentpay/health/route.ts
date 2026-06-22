import { loadDashboardConfig } from "@/lib/agentpayConfig";
import { NextResponse } from "next/server";

export async function GET() {
  const cfg = loadDashboardConfig();

  let reachable = false;
  let mode = "unknown";
  try {
    const res = await fetch(`${cfg.paidApiBaseUrl}/health`);
    if (res.ok) {
      const body = (await res.json()) as { mode?: string };
      reachable = true;
      mode = body.mode ?? "mock";
    }
  } catch {
    // Unreachable — return false without throwing.
  }

  return NextResponse.json({
    reachable,
    mode,
    paidApiBaseUrl: cfg.paidApiBaseUrl,
    hint: reachable
      ? undefined
      : "Start it with: pnpm --filter @cspr-agentpay/paid-api dev",
  });
}
