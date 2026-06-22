import { describe, expect, it } from "vitest";

import {
  PaymentReceiptSchema,
  type PaymentRequirement,
  type PaymentReceipt,
} from "@cspr-agentpay/protocol";
import request from "supertest";

import { createPaidApiServer, type PaidApiConfig } from "../src/server";

const cfg: PaidApiConfig = {
  mode: "mock",
  agentId: "agent_research_001",
  merchantId: "merchant_market_data_001",
  merchantAccount: "mock-merchant-account",
  policyId: "policy_demo_agent_001",
  port: 4000,
};

function app() {
  return createPaidApiServer(cfg);
}

async function setup() {
  const srv = request(app());
  const setupRes = await srv.post("/demo/setup").expect(200);
  return { srv, setupRes };
}

async function get402Requirement(
  srv: request.Agent,
): Promise<PaymentRequirement> {
  const res = await srv.get("/premium/parking-report/MAD-001").expect(402);
  expect(res.body.error).toBe("PAYMENT_REQUIRED");
  const requirement = res.body.paymentRequirement as PaymentRequirement;
  expect(requirement.requestHash).toMatch(/^[a-f0-9]{64}$/);
  return requirement;
}

async function authorizeAndSubmit(
  srv: request.Agent,
  requirement: PaymentRequirement,
): Promise<PaymentReceipt> {
  const authRes = await srv
    .post("/demo/authorize")
    .send({ policyId: cfg.policyId, requirement, agentId: cfg.agentId })
    .expect(200);

  const receipt = PaymentReceiptSchema.parse(authRes.body.receipt);
  expect(receipt.status).toBe("escrowed");
  return receipt;
}

describe("paid-api", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app()).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("cspr-agentpay-paid-api");
    expect(res.body.mode).toBe("mock");
  });

  it("GET /premium/parking-report before setup returns DEMO_NOT_INITIALIZED", async () => {
    const res = await request(app())
      .get("/premium/parking-report/MAD-001")
      .expect(503);
    expect(res.body.error).toBe("DEMO_NOT_INITIALIZED");
  });

  it("POST /demo/setup creates merchant and policy", async () => {
    const res = await request(app()).post("/demo/setup").expect(200);
    expect(res.body.mode).toBe("mock");
    expect(res.body.merchant.merchantId).toBe(cfg.merchantId);
    expect(res.body.policy.policyId).toBe(cfg.policyId);
    expect(Array.isArray(res.body.auditEvents)).toBe(true);
    expect(res.body.auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("402 without receipt returns valid PaymentRequirement", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    expect(requirement.method).toBe("GET");
    expect(requirement.amount).toBe("1000000000");
    expect(requirement.currency).toBe("CSPR");
    expect(requirement.endpointId).toBe("parking-report-v1");
    expect(requirement.merchantId).toBe(cfg.merchantId);
  });

  it("402 requestHash differs per call (unique nonce)", async () => {
    const { srv } = await setup();
    const r1 = await get402Requirement(srv);
    const r2 = await get402Requirement(srv);
    expect(r1.nonce).not.toBe(r2.nonce);
    expect(r1.requestHash).not.toBe(r2.requestHash);
  });

  it("malformed receipt returns 400", async () => {
    const { srv } = await setup();
    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", "not-json")
      .expect(400);
  });

  it("receipt with wrong requestHash is rejected", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);
    const tampered = { ...receipt, requestHash: "0".repeat(64) };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(tampered))
      .expect(404);
    expect(res.body.error).toBe("RECEIPT_NOT_FOUND");
  });

  it("receipt with wrong merchantId is rejected", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);
    const tampered = { ...receipt, merchantId: "wrong-merchant" };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(tampered))
      .expect(403);
    expect(res.body.error).toBe("MERCHANT_MISMATCH");
  });

  it("receipt with wrong endpointId is rejected", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);
    const tampered = { ...receipt, endpointId: "wrong-endpoint" };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(tampered))
      .expect(403);
    expect(res.body.error).toBe("ENDPOINT_MISMATCH");
  });

  it("receipt with wrong amount is rejected", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);
    const tampered = { ...receipt, amount: "999" };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(tampered))
      .expect(403);
    expect(res.body.error).toBe("AMOUNT_MISMATCH");
  });

  it("receipt with wrong currency fails schema validation (400)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);
    const tampered = { ...receipt, currency: "USD" };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(tampered))
      .expect(400);
    expect(res.body.error).toBe("MALFORMED_RECEIPT");
  });

  it("authorized (not escrowed) receipt is rejected", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);

    const authRes = await srv
      .post("/demo/authorize")
      .send({ policyId: cfg.policyId, requirement, agentId: cfg.agentId })
      .expect(200);

    const authorizedReceipt = { ...authRes.body.receipt, status: "authorized" };

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(authorizedReceipt))
      .expect(402);
    expect(res.body.error).toBe("PAYMENT_NOT_ESCROWED");
  });

  it("valid escrowed receipt returns premium report", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    expect(res.body.lotId).toBe("MAD-001");
    expect(res.body.location).toBe("Madrid");
    expect(res.body.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different lotIds produce different responseHashes", async () => {
    const { srv } = await setup();

    const r1 = await get402Requirement(srv);
    const rec1 = await authorizeAndSubmit(srv, r1);
    const res1 = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(rec1))
      .expect(200);

    const r2 = await get402Requirement(srv);
    const rec2 = await authorizeAndSubmit(srv, r2);
    const res2 = await srv
      .get("/premium/parking-report/BCN-001")
      .set("x-agentpay-receipt", JSON.stringify(rec2))
      .expect(200);

    expect(res2.body.responseHash).not.toBe(res1.body.responseHash);
  });

  it("premium endpoint marks fulfilled and allows re-read", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    const res2 = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);
    expect(res2.body.lotId).toBe("MAD-001");
  });

  it("settle fulfills a fulfilled payment", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    const settleRes = await srv
      .post(`/demo/settle/${receipt.paymentId}`)
      .expect(200);

    expect(settleRes.body.settlement.status).toBe("settled");
    expect(settleRes.body.payment.status).toBe("settled");
  });

  it("duplicate settlement is rejected (adapter throws 409)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    await srv
      .post(`/demo/settle/${receipt.paymentId}`)
      .expect(200);

    const res = await srv
      .post(`/demo/settle/${receipt.paymentId}`)
      .expect(409);
    expect(res.body.message).toContain("DUPLICATE_SETTLEMENT");
  });

  it("non-fulfilled settlement is rejected (409)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv
      .post(`/demo/settle/${receipt.paymentId}`)
      .expect(409);
    expect(res.body.error).toBe("INVALID_STATE_TRANSITION");
  });

  it("GET /demo/audit returns ordered audit events", async () => {
    const { srv } = await setup();
    const res = await srv.get("/demo/audit").expect(200);
    const events = res.body.auditEvents;
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(2);
    const types = events.map((e: { type: string }) => e.type);
    expect(types).toContain("merchant_registered");
    expect(types).toContain("policy_created");
  });

  it("works for different lotIds", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv
      .get("/premium/parking-report/BCN-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);
    expect(res.body.lotId).toBe("BCN-001");
  });

  it("POST /demo/authorize returns escrowed receipt and proof", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);

    const res = await srv
      .post("/demo/authorize")
      .send({ policyId: cfg.policyId, requirement, agentId: cfg.agentId })
      .expect(200);

    expect(res.body.authorization.paymentId).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.receipt.status).toBe("escrowed");
    expect(res.body.proof.kind).toBe("mock");
    expect(res.body.updatedPolicy.spentAmount).toBe(requirement.amount);
  });

  it("POST /demo/setup resets state (2 audit events on fresh adapter)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv);
    await authorizeAndSubmit(srv, requirement);

    const resetRes = await srv.post("/demo/setup").expect(200);
    // Fresh adapter with seedDemoData=false → 2 events (merchant + policy).
    expect(resetRes.body.auditEvents.length).toBe(2);

    const freshReq = await get402Requirement(srv);
    expect(freshReq.requestHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
