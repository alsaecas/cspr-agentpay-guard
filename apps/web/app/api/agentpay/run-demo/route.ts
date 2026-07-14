import { executeDemoFlow } from "@/lib/demoFlow";
import { NextResponse } from "next/server";
import {
  runGuardedX402Scenario,
  type GuardedDemoScenario,
} from "@cspr-agentpay/casper-adapter";

const SCENARIOS = new Set<GuardedDemoScenario>([
  "allowed-payment",
  "prompt-injection-attack",
  "replay-attack",
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      scenario?: string;
    };
    if (body.scenario) {
      if (!SCENARIOS.has(body.scenario as GuardedDemoScenario)) {
        return NextResponse.json(
          { success: false, error: "Unknown guarded x402 scenario." },
          { status: 400 },
        );
      }
      const scenario = await runGuardedX402Scenario(
        body.scenario as GuardedDemoScenario,
      );
      return NextResponse.json({ success: true, steps: [], ...scenario });
    }
    const result = await executeDemoFlow();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Demo flow failed",
      },
      { status: 500 },
    );
  }
}
