import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  createBodyHash,
  createPaymentId,
  createRequestHash,
  CasperProofSchema,
  PaymentReceiptSchema,
  PaymentStatusSchema,
  PolicyDecisionSchema,
  validateAgentPolicy,
  validateMerchant,
  validatePaymentRequirement,
  validateReceiptForRequest,
  type AgentPolicy,
  type PaymentReceipt,
  type PaymentRequirement,
} from "../src/index";

const future = "2030-01-01T00:05:00.000Z";
const issuedAt = "2030-01-01T00:00:00.000Z";
const validationNow = new Date("2030-01-01T00:01:00.000Z");

describe("protocol validation", () => {
  it("includes the demo state machine statuses", () => {
    expect(PaymentStatusSchema.options).toEqual(
      expect.arrayContaining([
        "required",
        "authorized",
        "submitted",
        "fulfilled",
        "settlement_failed",
      ]),
    );
  });

  it("validates mock Casper proofs", () => {
    const proof = CasperProofSchema.parse({
      kind: "mock",
      hash: "mock-proof-hash",
      eventId: "mock-proof-event",
    });

    expect(proof.kind).toBe("mock");
  });

  it("validates policy decisions", () => {
    const decision = PolicyDecisionSchema.parse({
      allowed: false,
      reason: "MERCHANT_NOT_ALLOWED",
      checkedAt: issuedAt,
      message: "Merchant is not on the policy allowlist.",
    });

    expect(decision.allowed).toBe(false);
  });

  it("accepts a valid policy", () => {
    const policy = validateAgentPolicy(validPolicy());

    expect(policy.policyId).toBe("policy_demo_agent_001");
  });

  it("rejects an invalid policy amount", () => {
    expect(() =>
      validateAgentPolicy({
        ...validPolicy(),
        maxAmountPerPayment: "not-an-amount",
      }),
    ).toThrow();
  });

  it("rejects an empty merchant", () => {
    expect(() =>
      validateMerchant({
        version: PROTOCOL_VERSION,
        merchantId: "",
        displayName: "Market Data Merchant",
        status: "active",
        casperAccount: "casper-account",
        settlementAccount: "casper-account",
        allowedOrigins: ["https://api.example.test"],
        allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
        createdAt: issuedAt,
      }),
    ).toThrow();
  });

  it("accepts a valid payment requirement", () => {
    const requirement = validatePaymentRequirement(validRequirement(), {
      now: validationNow,
    });

    expect(requirement.endpointId).toBe("premium-report-cspr");
  });

  it("rejects a requirement with an empty merchant account", () => {
    expect(() =>
      validatePaymentRequirement(
        {
          ...validRequirement(),
          merchantAccount: "",
        },
        { now: validationNow },
      ),
    ).toThrow();
  });

  it("rejects expired payment requirements", () => {
    expect(() =>
      validatePaymentRequirement(
        {
          ...validRequirement(),
          expiresAt: "2030-01-01T00:00:30.000Z",
        },
        { now: validationNow },
      ),
    ).toThrow("REQUIREMENT_EXPIRED");
  });

  it("rejects a receipt reused for a different request body", () => {
    const request = requestHashInput({ body: { symbol: "CSPR" } });
    const receipt: PaymentReceipt = {
      version: PROTOCOL_VERSION,
      paymentId: createPaymentId({
        policyId: "policy_demo_agent_001",
        merchantAccount: "mock-merchant-account",
        amount: "1000000000",
        endpointId: request.endpointId,
        requestHash: createRequestHash(request),
        nonce: "authorization-nonce",
      }),
      policyId: "policy_demo_agent_001",
      agentId: "agent_research_001",
      merchantId: "merchant_market_data_001",
      merchantAccount: "mock-merchant-account",
      endpointId: request.endpointId,
      requestHash: createRequestHash(request),
      amount: "1000000000",
      currency: "CSPR",
      status: "escrowed",
      chainMode: "mock",
      proof: {
        kind: "mock",
        hash: "mock-escrowed-hash",
        eventId: "mock-escrowed-event-id",
      },
      casperDeployHash: "mock-escrowed-hash",
      casperEventId: "mock-escrowed-event-id",
      receiptNonce: "receipt-nonce",
      issuedAt,
      expiresAt: future,
    };

    expect(() =>
      validateReceiptForRequest(
        receipt,
        requestHashInput({ body: { symbol: "ETH" } }),
      ),
    ).toThrow("REQUEST_HASH_MISMATCH");
  });

  it("validates receipts with proof objects", () => {
    const request = requestHashInput({ body: { symbol: "CSPR" } });
    const receipt = PaymentReceiptSchema.parse({
      version: PROTOCOL_VERSION,
      paymentId: createPaymentId({
        policyId: "policy_demo_agent_001",
        merchantAccount: "mock-merchant-account",
        amount: "1000000000",
        endpointId: request.endpointId,
        requestHash: createRequestHash(request),
        nonce: "authorization-nonce",
      }),
      policyId: "policy_demo_agent_001",
      agentId: "agent_research_001",
      merchantId: "merchant_market_data_001",
      merchantAccount: "mock-merchant-account",
      endpointId: request.endpointId,
      requestHash: createRequestHash(request),
      amount: "1000000000",
      currency: "CSPR",
      status: "escrowed",
      chainMode: "mock",
      proof: {
        kind: "mock",
        hash: "mock-escrowed-hash",
        eventId: "mock-escrowed-event-id",
      },
      receiptNonce: "receipt-nonce",
      issuedAt,
      expiresAt: future,
    });

    expect(receipt.proof.kind).toBe("mock");
  });
});

function validPolicy(): AgentPolicy {
  return {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo_agent_001",
    ownerAccount: "casper-owner-account",
    agentId: "agent_research_001",
    status: "active",
    currency: "CSPR",
    maxAmountPerPayment: "2500000000",
    totalBudget: "10000000000",
    spentAmount: "0",
    budgetWindow: "demo-total",
    allowedMerchantIds: ["merchant_market_data_001"],
    allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
    expiresAt: future,
    policyNonce: "policy-nonce-001",
    createdAt: issuedAt,
  };
}

function validRequirement(): PaymentRequirement {
  const request = requestHashInput({ body: {} });
  return {
    version: PROTOCOL_VERSION,
    requirementId: "req_001",
    merchantId: "merchant_market_data_001",
    merchantAccount: "mock-merchant-account",
    method: request.method,
    url: request.url,
    endpointId: request.endpointId,
    amount: "1000000000",
    currency: "CSPR",
    requestHash: createRequestHash(request),
    nonce: request.nonce,
    termsHash:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    escrowMode: "authorize_then_settle",
    expiresAt: future,
    issuedAt,
  };
}

function requestHashInput({ body }: { body: unknown }) {
  return {
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    bodyHash: createBodyHash(body),
    endpointId: "premium-report-cspr",
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce: "request-nonce",
    expiresAt: future,
  };
}
