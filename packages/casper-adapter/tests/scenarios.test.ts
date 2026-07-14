import { describe, expect, it } from "vitest";

import { runGuardedX402Scenario } from "../src/index";

describe("guarded x402 demo scenarios", () => {
  it("allows the valid payment and shows budget consumption", async () => {
    const result = await runGuardedX402Scenario("allowed-payment");
    expect(result.decision).toBe("ALLOW");
    expect(result.settlementAdapterCalled).toBe(true);
    expect(result.budgetBefore).toBe("10000");
    expect(result.budgetAfter).toBe("9900");
    expect(result.mode).toBe("mock");
    expect(result.casperEvidence?.mode).toBe("mock");
  });

  it("rejects prompt injection attempting to change amount and payee", async () => {
    const result = await runGuardedX402Scenario("prompt-injection-attack");
    expect(result.decision).toBe("DENY");
    expect(result.denialReason).toBe("PAYEE_NOT_ALLOWED");
    expect(result.settlementAdapterCalled).toBe(false);
    expect(result.budgetAfter).toBe(result.budgetBefore);
  });

  it("rejects a replayed requirement nonce", async () => {
    const result = await runGuardedX402Scenario("replay-attack");
    expect(result.decision).toBe("DENY");
    expect(result.denialReason).toBe("NONCE_ALREADY_USED");
    expect(result.settlementAdapterCalled).toBe(false);
  });
});
