import { loadDashboardConfig } from "@/lib/agentpayConfig";
import { setupSelfContainedDemo } from "@/lib/selfContainedDemo";
import { NextResponse } from "next/server";

export async function POST() {
  const cfg = loadDashboardConfig();

  if (cfg.demoBackend === "self-contained") {
    const body = await setupSelfContainedDemo(cfg);
    return NextResponse.json(body);
  }

  try {
    const res = await fetch(`${cfg.paidApiBaseUrl}/demo/setup`, {
      method: "POST",
    });
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
