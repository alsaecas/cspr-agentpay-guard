import { describe, expect, it } from "vitest";

import {
  NoSpendX402SettlementAdapter,
  runGuardedX402Scenario,
} from "../src/index";

describe("guarded x402 demo scenarios", () => {
  it("allows the valid payment and shows budget consumption", async () => {
    const result = await runGuardedX402Scenario("allowed-payment");
    expect(result.decision).toBe("ALLOW");
    expect(result.settlementAdapterCalled).toBe(true);
    expect(result.budgetBefore).toBe("400");
    expect(result.budgetAfter).toBe("300");
    expect(result.mode).toBe("mock-no-spend");
    expect(result.casperEvidence?.mode).toBe("mock");
    expect(result.demoPremiumResourceReleased).toBe(true);
    expect(result.premiumResponse?.assetId).toBe("MAD-001");
    expect(result.guardChecks.map((check) => check.check)).toContain("nonce");
  });

  it("rejects prompt injection attempting to change amount and payee", async () => {
    const result = await runGuardedX402Scenario("prompt-injection-attack");
    expect(result.decision).toBe("DENY");
    expect(result.denialReason).toBe("PAYEE_MISMATCH");
    expect(result.settlementAdapterCalled).toBe(false);
    expect(result.budgetAfter).toBe(result.budgetBefore);
  });

  it.each([
    ["amount-escalation", "AMOUNT_EXCEEDS_PAYMENT_LIMIT", "amount"],
    ["resource-substitution", "RESOURCE_NOT_ALLOWED", "resource"],
    ["expired-requirement", "REQUIREMENT_EXPIRED", "expiry"],
  ] as const)("uses the real guard for %s", async (scenario, reason, check) => {
    const result = await runGuardedX402Scenario(scenario);
    expect(result.denialReason).toBe(reason);
    expect(result.guardChecks.at(-1)).toMatchObject({
      check,
      passed: false,
      reason,
    });
    expect(result.demoPremiumResourceReleased).toBe(false);
  });

  it("uses an injected no-spend adapter without signer or submission calls", async () => {
    const adapter = new NoSpendX402SettlementAdapter();
    const result = await runGuardedX402Scenario("allowed-payment", {
      settlementAdapter: adapter,
    });
    expect(result.mockAuthorizationCalled).toBe(true);
    expect(adapter.calls.authorize).toBe(1);
    expect(adapter.calls.verify).toBe(1);
    expect(adapter.signerCalls).toBe(0);
    expect(adapter.submissionCalls).toBe(0);
    expect(result.signerCalled).toBe(false);
    expect(result.submissionCalled).toBe(false);
  });

  it("rejects a replayed requirement nonce", async () => {
    const result = await runGuardedX402Scenario("replay-attack");
    expect(result.decision).toBe("DENY");
    expect(result.denialReason).toBe("NONCE_ALREADY_USED");
    expect(result.settlementAdapterCalled).toBe(false);
  });
});
