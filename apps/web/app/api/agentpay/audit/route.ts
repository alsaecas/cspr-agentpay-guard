import { NextResponse } from "next/server";

const BASE_URL = process.env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000";

export async function GET() {
  try {
    const res = await fetch(`${BASE_URL}/demo/audit`);
    const body = await res.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      {
        error: "UNREACHABLE",
        message: "Paid API is unreachable. Start it with: pnpm --filter @cspr-agentpay/paid-api dev",
      },
      { status: 503 },
    );
  }
}
