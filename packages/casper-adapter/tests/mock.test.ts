import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  type PaymentAuthorization,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";

import { MockCasperPaymentAdapter } from "../src/index";

describe("MockCasperPaymentAdapter", () => {
  it("returns request-bound mock receipts", async () => {
    const adapter = new MockCasperPaymentAdapter();
    const requirement: PaymentRequirement = {
      version: PROTOCOL_VERSION,
      requirementId: "req_001",
      merchantId: "merchant_market_data_001",
      merchantAccount: "mock-merchant-account",
      method: "GET",
      url: "https://api.example.test/premium/report?symbol=CSPR",
      resourceId: "premium-report-cspr",
      amount: "1000000000",
      currency: "CSPR",
      requestHash:
        "d52ebc6bb72c8da8aa998f348f27c50eea07e5af9245f0e697c5bbf12dc8e4aa",
      requirementNonce: "requirement-nonce",
      termsHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      escrowMode: "authorize_then_settle",
      expiresAt: "2026-06-03T00:05:00.000Z",
      issuedAt: "2026-06-03T00:00:00.000Z",
    };
    const authorization: PaymentAuthorization = {
      version: PROTOCOL_VERSION,
      paymentId:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      policyId: "policy_demo_agent_001",
      agentId: "agent_research_001",
      merchantId: "merchant_market_data_001",
      requirementId: "req_001",
      requestHash: requirement.requestHash,
      amount: requirement.amount,
      currency: "CSPR",
      authorizationNonce: "authorization-nonce",
      expiresAt: requirement.expiresAt,
      authorizedAt: "2026-06-03T00:00:10.000Z",
      signature: "mock-signature",
    };

    const receipt = await adapter.submitPayment({
      requirement,
      authorization,
      now: new Date("2026-06-03T00:00:20.000Z"),
    });

    expect(receipt.status).toBe("escrowed");
    expect(receipt.paymentId).toBe(authorization.paymentId);
    expect(receipt.requestHash).toBe(requirement.requestHash);
    expect(receipt.casperDeployHash).toContain("mock-deploy-");
  });
});
