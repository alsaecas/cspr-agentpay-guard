import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
} from "@x402/core/http";
import type { PaymentRequired, SettleResponse } from "@x402/core/types";
import {
  PROTOCOL_VERSION,
  createBodyHash,
  createRequestHash,
  type AgentPolicy,
  type Merchant,
} from "@cspr-agentpay/protocol";
import { describe, expect, it } from "vitest";

import {
  MockX402SettlementAdapter,
  RealX402SettlementAdapter,
  guardedFetch,
} from "../src/index";

const now = new Date("2030-01-01T00:00:00.000Z");
const expiresAt = "2030-01-01T00:05:00.000Z";
const url = "https://api.example.test/premium/report?symbol=CSPR";
const endpointId = "premium-report-cspr";
const body = { symbol: "CSPR" };

describe("guardedFetch", () => {
  it("reports exact missing real x402 configuration", () => {
    expect(RealX402SettlementAdapter.getMissingConfiguration({})).toEqual([
      "X402_CASPER_FACILITATOR_URL",
      "CASPER_TESTNET_PUBLIC_KEY",
      "CASPER_TESTNET_SECRET_KEY_PATH",
    ]);
    expect(() => RealX402SettlementAdapter.assertConfiguration({})).toThrow(
      "Real Casper x402 configuration is incomplete",
    );
  });

  it("allows a valid payment and calls settlement only after policy approval", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({ adapter });

    expect(result.paid).toBe(true);
    expect("decision" in result && result.decision.allowed).toBe(true);
    expect(adapter.calls).toEqual({
      inspect: 1,
      authorize: 1,
      settle: 1,
      verify: 1,
    });
    expect("updatedPolicy" in result && result.updatedPolicy.spentAmount).toBe(
      "100",
    );
    expect("evidence" in result && result.evidence.mode).toBe("mock");
  });

  it.each([
    ["wrong payee", { payTo: "account-wrong" }, {}, "PAYEE_NOT_ALLOWED"],
    [
      "modified amount",
      { amount: "101" },
      { expectedAmount: "100" },
      "AMOUNT_MISMATCH",
    ],
    [
      "amount over limit",
      { amount: "1001" },
      { expectedAmount: "1001" },
      "AMOUNT_EXCEEDS_PAYMENT_LIMIT",
    ],
    ["wrong network", { network: "casper:mainnet" }, {}, "NETWORK_NOT_ALLOWED"],
    ["wrong asset", { asset: "fake-token" }, {}, "ASSET_NOT_ALLOWED"],
    [
      "facilitator mismatch",
      {},
      { facilitator: "https://evil.example" },
      "FACILITATOR_NOT_ALLOWED",
    ],
  ] as const)(
    "denies %s without calling signer or settlement",
    async (_name, acceptance, options, reason) => {
      const adapter = new MockX402SettlementAdapter();
      const result = await run({ adapter, acceptance, ...options });

      expect("decision" in result && result.decision.reason).toBe(reason);
      expect(adapter.calls.authorize).toBe(0);
      expect(adapter.calls.settle).toBe(0);
      expect(
        "settlementAdapterCalled" in result && result.settlementAdapterCalled,
      ).toBe(false);
    },
  );

  it("denies an exhausted budget", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({
      adapter,
      policy: policy({ spentAmount: "9950", totalBudget: "10000" }),
    });
    expect("decision" in result && result.decision.reason).toBe(
      "BUDGET_EXCEEDED",
    );
    expect(adapter.calls.settle).toBe(0);
  });

  it("denies an invalid owner policy permit before signing", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({ adapter, policySignatureValid: false });
    expect("decision" in result && result.decision.reason).toBe(
      "POLICY_SIGNATURE_INVALID",
    );
    expect(adapter.calls.authorize).toBe(0);
    expect(adapter.calls.settle).toBe(0);
  });

  it("denies an expired requirement", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({
      adapter,
      expiresAt: "2029-12-31T23:59:59.000Z",
    });
    expect("decision" in result && result.decision.reason).toBe(
      "REQUIREMENT_EXPIRED",
    );
    expect(adapter.calls.settle).toBe(0);
  });

  it("denies a modified URL", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({
      adapter,
      resourceUrl: "https://api.example.test/premium/other",
    });
    expect("decision" in result && result.decision.reason).toBe(
      "REQUEST_HASH_MISMATCH",
    );
    expect(adapter.calls.settle).toBe(0);
  });

  it("denies a modified request body", async () => {
    const adapter = new MockX402SettlementAdapter();
    const requirement = requirementFor({ body: { symbol: "BTC" } });
    const result = await run({ adapter, requirement });
    expect("decision" in result && result.decision.reason).toBe(
      "BODY_HASH_MISMATCH",
    );
    expect(adapter.calls.settle).toBe(0);
  });

  it("denies malformed requirements without calling signer or settlement", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await run({
      adapter,
      requirement: { x402Version: 2 } as PaymentRequired,
    });
    expect("decision" in result && result.decision.reason).toBe(
      "MALFORMED_REQUIREMENT",
    );
    expect(adapter.calls.authorize).toBe(0);
    expect(adapter.calls.settle).toBe(0);
  });

  it("rejects a replayed nonce before settlement", async () => {
    const adapter = new MockX402SettlementAdapter();
    const usedNonces = new Set(["merchant_market_data_001:nonce-001"]);
    const result = await run({ adapter, usedNonces });
    expect("decision" in result && result.decision.reason).toBe(
      "NONCE_ALREADY_USED",
    );
    expect(adapter.calls.settle).toBe(0);
  });

  it("rejects duplicate settlement attempts", async () => {
    const adapter = new MockX402SettlementAdapter();
    const request = adapter.inspectRequirement({
      paymentRequired: requirementFor(),
      method: "POST",
      url,
      body,
      agentId: "agent_research_001",
      endpointId,
    });
    const authorization = await adapter.createPaymentAuthorization({
      request,
      decision: {
        allowed: true,
        decision: "ALLOW",
        policyId: "policy_demo",
        merchantId: request.merchantId,
        checkedAt: now.toISOString(),
        checks: [],
        budgetBefore: "10000",
        budgetAfter: "9900",
      },
    });
    await adapter.settle(authorization);
    await expect(adapter.settle(authorization)).rejects.toThrow(
      "DUPLICATE_SETTLEMENT",
    );
  });

  it("returns non-402 responses without inspecting or settling", async () => {
    const adapter = new MockX402SettlementAdapter();
    const result = await guardedFetch(url, {
      method: "POST",
      body,
      policyId: "policy_demo",
      agentId: "agent_research_001",
      policy: policy(),
      merchant: merchant(),
      settlementAdapter: adapter,
      fetchFn: async () => new Response("free", { status: 200 }),
      now,
    });
    expect(result.paid).toBe(false);
    expect(adapter.calls).toEqual({
      inspect: 0,
      authorize: 0,
      settle: 0,
      verify: 0,
    });
  });

  it("does not settle when the paid retry fails", async () => {
    const adapter = new MockX402SettlementAdapter();
    let calls = 0;
    await expect(
      guardedFetch(url, {
        method: "POST",
        body,
        endpointId,
        expectedAmount: "100",
        policyId: "policy_demo",
        agentId: "agent_research_001",
        policy: policy(),
        merchant: merchant(),
        settlementAdapter: adapter,
        now,
        fetchFn: async () => {
          calls += 1;
          return calls === 1
            ? new Response(null, {
                status: 402,
                headers: {
                  "PAYMENT-REQUIRED":
                    encodePaymentRequiredHeader(requirementFor()),
                },
              })
            : new Response("provider failed", { status: 500 });
        },
      }),
    ).rejects.toThrow("Paid request retry failed");
    expect(adapter.calls.authorize).toBe(1);
    expect(adapter.calls.settle).toBe(0);
    expect(adapter.calls.verify).toBe(0);
  });

  it("never fabricates a transaction hash when the real signer is unavailable", async () => {
    const adapter = new RealX402SettlementAdapter({
      network: "casper:casper-test",
    });
    await expect(run({ adapter })).rejects.toThrow(
      "X402_CASPER_SIGNER_UNAVAILABLE",
    );
  });
});

async function run(input: {
  adapter: MockX402SettlementAdapter | RealX402SettlementAdapter;
  acceptance?: Record<string, unknown>;
  facilitator?: string;
  expectedAmount?: string;
  policy?: AgentPolicy;
  expiresAt?: string;
  resourceUrl?: string;
  requirement?: PaymentRequired;
  usedNonces?: Set<string>;
  policySignatureValid?: boolean;
}) {
  const paymentRequired =
    input.requirement ??
    requirementFor({
      ...(input.acceptance ? { acceptance: input.acceptance } : {}),
      ...(input.facilitator ? { facilitator: input.facilitator } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(input.resourceUrl ? { resourceUrl: input.resourceUrl } : {}),
    });
  let calls = 0;
  const fetchFn: typeof fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: "payment required" }), {
        status: 402,
        headers: {
          "content-type": "application/json",
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
        },
      });
    }
    expect(new Headers(init?.headers).has("PAYMENT-SIGNATURE")).toBe(true);
    const settlement: SettleResponse = {
      success: true,
      transaction: "mock-settlement",
      network: "casper:casper-test",
    };
    return new Response(JSON.stringify({ premium: true }), {
      status: 200,
      headers: { "PAYMENT-RESPONSE": encodePaymentResponseHeader(settlement) },
    });
  };

  return guardedFetch(url, {
    method: "POST",
    body,
    endpointId,
    expectedAmount: input.expectedAmount ?? "100",
    policyId: "policy_demo",
    agentId: "agent_research_001",
    policy: input.policy ?? policy(),
    merchant: merchant(),
    settlementAdapter: input.adapter,
    fetchFn,
    usedNonces: input.usedNonces,
    policySignatureValid: input.policySignatureValid,
    now,
  });
}

function requirementFor(
  input: {
    acceptance?: Record<string, unknown>;
    facilitator?: string;
    expiresAt?: string;
    resourceUrl?: string;
    body?: unknown;
  } = {},
): PaymentRequired {
  const expiry = input.expiresAt ?? expiresAt;
  const requestBody = input.body ?? body;
  const bodyHash = createBodyHash(requestBody);
  const requestHash = createRequestHash({
    method: "POST",
    url,
    bodyHash,
    endpointId,
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce: "nonce-001",
    expiresAt: expiry,
  });
  return {
    x402Version: 2,
    resource: { url: input.resourceUrl ?? url, description: "Premium report" },
    accepts: [
      {
        scheme: "exact",
        network: "casper:casper-test",
        asset: "CSPR",
        amount: "100",
        payTo: "account-merchant",
        maxTimeoutSeconds: 300,
        extra: {
          agentPayGuard: {
            merchantId: "merchant_market_data_001",
            providerId: "provider-001",
            nonce: "nonce-001",
            issuedAt: now.toISOString(),
            expiresAt: expiry,
            requestHash,
            bodyHash,
            ...(input.facilitator ? { facilitator: input.facilitator } : {}),
          },
        },
        ...input.acceptance,
      },
    ],
  };
}

function policy(overrides: Partial<AgentPolicy> = {}): AgentPolicy {
  return {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo",
    ownerAccount: "owner",
    agentId: "agent_research_001",
    status: "active",
    currency: "CSPR",
    maxAmountPerPayment: "1000",
    totalBudget: "10000",
    spentAmount: "0",
    budgetWindow: "demo-total",
    allowedMerchantIds: ["merchant_market_data_001"],
    allowedResourcePatterns: ["POST https://api.example.test/premium/*"],
    allowedNetworks: ["casper:casper-test"],
    allowedAssets: ["CSPR"],
    allowedPayees: ["account-merchant"],
    allowedFacilitators: ["https://facilitator.example"],
    expiresAt,
    policyNonce: "policy-nonce",
    createdAt: now.toISOString(),
    ...overrides,
  };
}

function merchant(): Merchant {
  return {
    version: PROTOCOL_VERSION,
    merchantId: "merchant_market_data_001",
    displayName: "Merchant",
    status: "active",
    casperAccount: "account-merchant",
    settlementAccount: "account-merchant",
    allowedOrigins: ["https://api.example.test"],
    allowedResourcePatterns: ["POST https://api.example.test/premium/*"],
    createdAt: now.toISOString(),
  };
}
