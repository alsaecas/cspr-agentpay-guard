import { executeDemoFlow } from "@/lib/demoFlow";
import { NextResponse } from "next/server";

export async function POST() {
  try {
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
