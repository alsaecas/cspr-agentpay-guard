import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  type AgentPolicy,
  type Merchant,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";

import { MockCasperPaymentAdapter } from "../src/index";

const now = new Date("2030-01-01T00:00:00.000Z");
const future = "2030-01-01T00:05:00.000Z";

describe("MockCasperPaymentAdapter", () => {
  it("creates policies", async () => {
    const adapter = newAdapter();
    const policy = await adapter.createPolicy(validPolicy());

    expect(policy.policyId).toBe("policy_demo_agent_001");
    await expect(adapter.getPolicy(policy.policyId)).resolves.toEqual(policy);
  });

  it("registers merchants", async () => {
    const adapter = newAdapter();
    const merchant = await adapter.registerMerchant(validMerchant());

    expect(merchant.merchantId).toBe("merchant_market_data_001");
    await expect(adapter.getMerchant(merchant.merchantId)).resolves.toEqual(
      merchant,
    );
  });

  it("authorizes payments through the policy engine", async () => {
    const adapter = await readyAdapter();
    const request = requestInput("requirement-nonce-001");
    const requirement = validRequirement(request);
    const result = await adapter.authorizePayment({
      policyId: "policy_demo_agent_001",
      requirement,
      request,
      authorizationNonce: "authorization-nonce-001",
      now,
    });

    expect(result.decision.allowed).toBe(true);
    expect(result.authorization.paymentId).toMatch(/^[a-f0-9]{64}$/);
    expect(result.receipt.status).toBe("authorized");
    expect(result.receipt.proof.kind).toBe("mock");
    expect(result.updatedPolicy.spentAmount).toBe(requirement.amount);
  });

  it("submits payments into escrow", async () => {
    const { adapter, paymentId } = await authorizedPayment();
    const receipt = await adapter.submitPayment({ paymentId, now });

    expect(receipt.status).toBe("escrowed");
    expect(receipt.casperDeployHash).toContain("mock-escrowed-");
  });

  it("marks fulfilled payments", async () => {
    const { adapter, paymentId } = await escrowedPayment();
    const receipt = await adapter.markFulfilled({
      paymentId,
      responseBody: { symbol: "CSPR", paid: true },
      now,
    });

    expect(receipt.status).toBe("fulfilled");
    expect(receipt.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("settles fulfilled payments", async () => {
    const { adapter, paymentId } = await fulfilledPayment();
    const settlement = await adapter.settlePayment({ paymentId, now });
    const payment = await adapter.getPayment(paymentId);

    expect(settlement.status).toBe("settled");
    expect(settlement.casperDeployHash).toContain("mock-settled-");
    expect(payment?.status).toBe("settled");
  });

  it("rejects duplicate settlement", async () => {
    const { adapter, paymentId } = await fulfilledPayment();
    await adapter.settlePayment({ paymentId, now });

    await expect(adapter.settlePayment({ paymentId, now })).rejects.toThrow(
      "DUPLICATE_SETTLEMENT",
    );
  });

  it("rejects reused authorization nonces", async () => {
    const adapter = await readyAdapter();
    const firstRequest = requestInput("requirement-nonce-001");
    await adapter.authorizePayment({
      policyId: "policy_demo_agent_001",
      requirement: validRequirement(firstRequest),
      request: firstRequest,
      authorizationNonce: "authorization-nonce-reused",
      now,
    });

    const secondRequest = requestInput("requirement-nonce-002");
    await expect(
      adapter.authorizePayment({
        policyId: "policy_demo_agent_001",
        requirement: validRequirement(secondRequest),
        request: secondRequest,
        authorizationNonce: "authorization-nonce-reused",
        now,
      }),
    ).rejects.toThrow("REPLAY_DETECTED");
  });

  it("rejects reused receipt nonces", async () => {
    const adapter = await readyAdapter();
    const firstRequest = requestInput("requirement-nonce-001");
    await adapter.authorizePayment({
      policyId: "policy_demo_agent_001",
      requirement: validRequirement(firstRequest),
      request: firstRequest,
      authorizationNonce: "authorization-nonce-001",
      receiptNonce: "receipt-nonce-reused",
      now,
    });

    const secondRequest = requestInput("requirement-nonce-002");
    await expect(
      adapter.authorizePayment({
        policyId: "policy_demo_agent_001",
        requirement: validRequirement(secondRequest),
        request: secondRequest,
        authorizationNonce: "authorization-nonce-002",
        receiptNonce: "receipt-nonce-reused",
        now,
      }),
    ).rejects.toThrow("REPLAY_DETECTED");
  });

  it("rejects replayed payment IDs", async () => {
    const adapter = await readyAdapter();
    const request = requestInput("requirement-nonce-001");
    const requirement = validRequirement(request);
    await adapter.authorizePayment({
      policyId: "policy_demo_agent_001",
      requirement,
      request,
      authorizationNonce: "authorization-nonce-001",
      now,
    });

    await expect(
      adapter.authorizePayment({
        policyId: "policy_demo_agent_001",
        requirement,
        request,
        authorizationNonce: "authorization-nonce-001",
        now,
      }),
    ).rejects.toThrow("REPLAY_DETECTED");
  });

  it("lists audit events in timeline order", async () => {
    const { adapter, paymentId } = await fulfilledPayment();
    await adapter.settlePayment({ paymentId, now });
    const events = await adapter.listAuditEvents({ paymentId });

    expect(events.map((event) => event.type)).toEqual([
      "payment_authorized",
      "payment_submitted",
      "payment_escrowed",
      "payment_fulfilled",
      "payment_settled",
    ]);
  });
});

function newAdapter() {
  return new MockCasperPaymentAdapter({
    seed: "test-seed",
    seedDemoData: false,
  });
}

async function readyAdapter() {
  const adapter = newAdapter();
  await adapter.createPolicy(validPolicy());
  await adapter.registerMerchant(validMerchant());
  return adapter;
}

async function authorizedPayment() {
  const adapter = await readyAdapter();
  const request = requestInput("requirement-nonce-001");
  const result = await adapter.authorizePayment({
    policyId: "policy_demo_agent_001",
    requirement: validRequirement(request),
    request,
    authorizationNonce: "authorization-nonce-001",
    now,
  });

  return {
    adapter,
    paymentId: result.authorization.paymentId,
  };
}

async function escrowedPayment() {
  const state = await authorizedPayment();
  await state.adapter.submitPayment({ paymentId: state.paymentId, now });
  return state;
}

async function fulfilledPayment() {
  const state = await escrowedPayment();
  await state.adapter.markFulfilled({
    paymentId: state.paymentId,
    responseBody: { symbol: "CSPR", paid: true },
    now,
  });
  return state;
}

function validPolicy(): AgentPolicy {
  return {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo_agent_001",
    ownerAccount: "mock-owner-account",
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

function requestInput(nonce: string) {
  return {
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    bodyHash: createBodyHash({ symbol: "CSPR" }),
    endpointId: "premium-report-cspr",
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce,
    expiresAt: future,
  };
}

function validRequirement(
  request: ReturnType<typeof requestInput>,
): PaymentRequirement {
  return {
    version: PROTOCOL_VERSION,
    requirementId: `req_${request.nonce}`,
    merchantId: request.merchantId,
    merchantAccount: "mock-merchant-account",
    method: request.method,
    url: request.url,
    endpointId: request.endpointId,
    amount: "1000000000",
    currency: "CSPR",
    requestHash: createRequestHash(request),
    nonce: request.nonce,
    termsHash: blake2b256Hex("premium report terms"),
    escrowMode: "authorize_then_settle",
    expiresAt: request.expiresAt,
    issuedAt: "2030-01-01T00:00:00.000Z",
  };
}
