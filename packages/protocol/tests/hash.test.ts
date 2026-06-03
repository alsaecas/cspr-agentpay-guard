import { describe, expect, it } from "vitest";

import { computePaymentId, computeRequestHash } from "../src/index";

describe("protocol hashes", () => {
  it("computes deterministic request hashes with normalized query order", () => {
    const left = computeRequestHash({
      method: "get",
      url: "https://api.example.test/premium/report?symbol=CSPR&kind=daily",
      resourceId: "premium-report-cspr",
      merchantId: "merchant_market_data_001",
      agentId: "agent_research_001",
      body: {},
    });
    const right = computeRequestHash({
      method: "GET",
      url: "https://api.example.test/premium/report?kind=daily&symbol=CSPR",
      resourceId: "premium-report-cspr",
      merchantId: "merchant_market_data_001",
      agentId: "agent_research_001",
      body: {},
    });

    expect(left).toEqual(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computes deterministic payment ids", () => {
    const paymentId = computePaymentId({
      policyId: "policy_demo_agent_001",
      agentId: "agent_research_001",
      merchantId: "merchant_market_data_001",
      requirementId: "req_001",
      requestHash:
        "d52ebc6bb72c8da8aa998f348f27c50eea07e5af9245f0e697c5bbf12dc8e4aa",
      amount: "1000000000",
      currency: "CSPR",
      requirementNonce: "requirement-nonce",
      authorizationNonce: "authorization-nonce",
    });

    expect(paymentId).toMatch(/^[a-f0-9]{64}$/);
  });
});
