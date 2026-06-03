import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  type AgentPolicy,
  type Merchant,
  type PaymentRequirement,
  type PolicyDenialReason,
} from "@cspr-agentpay/protocol";

import {
  calculateRemainingBudget,
  evaluatePaymentPolicy,
  matchResourcePattern,
  updateSpendStateAfterAuthorization,
} from "../src/index";

const now = new Date("2030-01-01T00:00:00.000Z");
const future = "2030-01-01T00:05:00.000Z";

describe("policy engine", () => {
  it("allows a valid payment", () => {
    const decision = evaluatePaymentPolicy(validInput());

    expect(decision.allowed).toBe(true);
    expect(decision.remainingBudget).toBe("10000000000");
  });

  it.each([
    ["paused", "2030-01-01T00:05:00.000Z"],
    ["revoked", "2030-01-01T00:05:00.000Z"],
    ["active", "2029-12-31T23:59:59.000Z"],
  ] as const)("rejects %s or expired policies", (status, expiresAt) => {
    expectDenied(
      validInput({
        policy: {
          ...validPolicy(),
          status,
          expiresAt,
        },
      }),
      "POLICY_INACTIVE",
    );
  });

  it("rejects inactive merchants", () => {
    expectDenied(
      validInput({
        merchant: {
          ...validMerchant(),
          status: "paused",
        },
      }),
      "MERCHANT_INACTIVE",
    );
  });

  it("rejects non-allowlisted merchants", () => {
    expectDenied(
      validInput({
        policy: {
          ...validPolicy(),
          allowedMerchantIds: ["merchant_compute_002"],
        },
      }),
      "MERCHANT_NOT_ALLOWED",
    );
  });

  it("rejects destination mismatches", () => {
    expectDenied(
      validInput({
        requirement: {
          ...validRequirement(),
          merchantAccount: "wrong-merchant-account",
        },
      }),
      "MERCHANT_DESTINATION_MISMATCH",
    );
  });

  it("rejects resource pattern mismatches", () => {
    expectDenied(
      validInput({
        policy: {
          ...validPolicy(),
          allowedResourcePatterns: ["GET https://api.example.test/basic/*"],
        },
      }),
      "RESOURCE_NOT_ALLOWED",
    );
  });

  it("rejects payments above the per-payment max", () => {
    expectDenied(
      validInput({
        requirement: validRequirement({ amount: "3000000000" }),
      }),
      "AMOUNT_EXCEEDS_PAYMENT_LIMIT",
    );
  });

  it("rejects payments above the remaining budget", () => {
    expectDenied(
      validInput({
        policy: {
          ...validPolicy(),
          spentAmount: "9500000000",
        },
      }),
      "BUDGET_EXCEEDED",
    );
  });

  it("rejects currency mismatches", () => {
    expectDenied(
      validInput({
        requirement: validRequirement({
          currency: "USD" as "CSPR",
        }),
      }),
      "CURRENCY_MISMATCH",
    );
  });

  it("rejects expired requirements", () => {
    expectDenied(
      validInput({
        requirement: validRequirement({
          expiresAt: "2029-12-31T23:59:59.000Z",
        }),
      }),
      "REQUIREMENT_EXPIRED",
    );
  });

  it("rejects request hash mismatches", () => {
    expectDenied(
      {
        ...validInput(),
        expectedRequestHash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      "REQUEST_HASH_MISMATCH",
    );
  });

  it("matches wildcard resource patterns against normalized URLs", () => {
    expect(
      matchResourcePattern("get", "https://api.example.test/premium/report", [
        "GET https://api.example.test/premium/*",
      ]),
    ).toBe(true);
  });

  it("updates policy spend after authorization", () => {
    const updated = updateSpendStateAfterAuthorization(
      validPolicy(),
      "1000000000",
    );

    expect(updated.spentAmount).toBe("1000000000");
    expect(calculateRemainingBudget(updated)).toBe(9000000000n);
  });
});

function expectDenied(
  input: Parameters<typeof evaluatePaymentPolicy>[0],
  reason: PolicyDenialReason,
) {
  const decision = evaluatePaymentPolicy(input);
  expect(decision.allowed).toBe(false);
  expect(decision.reason).toBe(reason);
}

function validInput(
  overrides: {
    policy?: AgentPolicy;
    merchant?: Merchant;
    requirement?: PaymentRequirement;
  } = {},
) {
  const requirement = overrides.requirement ?? validRequirement();
  const expectedRequestHash = createRequestHash({
    method: requirement.method,
    url: requirement.url,
    bodyHash: createBodyHash({ symbol: "CSPR" }),
    endpointId: requirement.endpointId,
    merchantId: requirement.merchantId,
    agentId: "agent_research_001",
    nonce: requirement.nonce,
    expiresAt: requirement.expiresAt,
  });

  return {
    policy: overrides.policy ?? validPolicy(),
    merchant: overrides.merchant ?? validMerchant(),
    requirement,
    expectedRequestHash,
    now,
  };
}

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
    createdAt: "2030-01-01T00:00:00.000Z",
  };
}

function validMerchant(): Merchant {
  return {
    version: PROTOCOL_VERSION,
    merchantId: "merchant_market_data_001",
    displayName: "Market Data Merchant",
    status: "active",
    casperAccount: "mock-merchant-account",
    settlementAccount: "mock-merchant-account",
    allowedOrigins: ["https://api.example.test"],
    allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
    createdAt: "2030-01-01T00:00:00.000Z",
  };
}

function validRequirement(
  overrides: Partial<PaymentRequirement> = {},
): PaymentRequirement {
  const base = {
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    bodyHash: createBodyHash({ symbol: "CSPR" }),
    endpointId: "premium-report-cspr",
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce: "requirement-nonce-001",
    expiresAt: future,
  };

  const requestHash = createRequestHash(base);

  return {
    version: PROTOCOL_VERSION,
    requirementId: "req_001",
    merchantId: base.merchantId,
    merchantAccount: "mock-merchant-account",
    method: base.method,
    url: base.url,
    endpointId: base.endpointId,
    amount: "1000000000",
    currency: "CSPR",
    requestHash,
    nonce: base.nonce,
    termsHash: blake2b256Hex("premium report terms"),
    escrowMode: "authorize_then_settle",
    expiresAt: base.expiresAt,
    issuedAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}
