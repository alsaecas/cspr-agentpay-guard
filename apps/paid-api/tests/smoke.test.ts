import { describe, expect, it, vi } from "vitest";
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";

import {
  PaymentReceiptSchema,
  type PaymentRequirement,
  type PaymentReceipt,
  normalizeX402PaymentRequired,
  createCasperPaymentAuthorizationHash,
} from "@cspr-agentpay/protocol";
import {
  CasperSettlementVerifier,
  MemoryConsumedTransactionStore,
  buildCasperPaymentAuthorization,
  type ObservedCasperTransfer,
} from "@cspr-agentpay/casper-adapter";
import { KeyAlgorithm, PrivateKey } from "casper-js-sdk";
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

/**
 * Call a premium endpoint without receipt → get the 402 requirement.
 * Defaults to MAD-001; pass a different lotId to target another lot.
 */
async function get402Requirement(
  srv: request.Agent,
  lotId = "MAD-001",
): Promise<PaymentRequirement> {
  const res = await srv.get(`/premium/parking-report/${lotId}`).expect(402);
  expect(res.body.error).toBe("PAYMENT_REQUIRED");
  const requirement = res.body.paymentRequirement as PaymentRequirement;
  expect(requirement.requestHash).toMatch(/^[a-f0-9]{64}$/);
  return requirement;
}

/** Call /demo/authorize + return the escrowed receipt. */
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
  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  it("GET /health returns ok", async () => {
    const res = await request(app()).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("cspr-agentpay-paid-api");
    expect(res.body.mode).toBe("mock");
  });

  // -----------------------------------------------------------------------
  // Before setup
  // -----------------------------------------------------------------------

  it("GET /premium/parking-report before setup returns DEMO_NOT_INITIALIZED", async () => {
    const res = await request(app())
      .get("/premium/parking-report/MAD-001")
      .expect(503);
    expect(res.body.error).toBe("DEMO_NOT_INITIALIZED");
  });

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------

  it("POST /demo/setup creates merchant and policy", async () => {
    const res = await request(app()).post("/demo/setup").expect(200);
    expect(res.body.mode).toBe("mock");
    expect(res.body.merchant.merchantId).toBe(cfg.merchantId);
    expect(res.body.policy.policyId).toBe(cfg.policyId);
    expect(Array.isArray(res.body.auditEvents)).toBe(true);
    expect(res.body.auditEvents.length).toBeGreaterThanOrEqual(2);
  });

  // -----------------------------------------------------------------------
  // 402 Payment Required
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Receipt validation — negative cases
  // -----------------------------------------------------------------------

  it("malformed receipt returns 400", async () => {
    const { srv } = await setup();
    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", "not-json")
      .expect(400);
  });

  it("receipt with wrong requestHash is rejected (RECEIPT_NOT_FOUND)", async () => {
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

  // -----------------------------------------------------------------------
  // Request-bound receipt: cross-lotId rejection
  // -----------------------------------------------------------------------

  it("receipt for MAD-001 is rejected on BCN-001 (REQUEST_HASH_MISMATCH)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    // Try using the MAD-001 receipt on BCN-001.
    const res = await srv
      .get("/premium/parking-report/BCN-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(403);
    expect(res.body.error).toBe("REQUEST_HASH_MISMATCH");
  });

  it("receipt for MAD-001 is rejected on VAL-001", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv
      .get("/premium/parking-report/VAL-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(403);
    expect(res.body.error).toBe("REQUEST_HASH_MISMATCH");
  });

  // -----------------------------------------------------------------------
  // Happy path: valid escrowed receipt → premium data
  // -----------------------------------------------------------------------

  it("valid escrowed receipt returns premium report", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    expect(res.body.lotId).toBe("MAD-001");
    expect(res.body.location).toBe("Madrid");
    expect(res.body.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different lotIds produce different responseHashes (each with own receipt)", async () => {
    const { srv } = await setup();

    // MAD-001: get requirement + authorize separate receipt.
    const reqMad = await get402Requirement(srv, "MAD-001");
    const recMad = await authorizeAndSubmit(srv, reqMad);
    const resMad = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(recMad))
      .expect(200);

    // BCN-001: get requirement + authorize separate receipt.
    const reqBcn = await get402Requirement(srv, "BCN-001");
    const recBcn = await authorizeAndSubmit(srv, reqBcn);
    const resBcn = await srv
      .get("/premium/parking-report/BCN-001")
      .set("x-agentpay-receipt", JSON.stringify(recBcn))
      .expect(200);

    // Each receipt works on its own lot AND produces a different responseHash.
    expect(resBcn.body.responseHash).not.toBe(resMad.body.responseHash);
  });

  it("premium endpoint marks fulfilled and allows re-read", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    // Second access with same receipt — still works (fulfilled is acceptable).
    const res2 = await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);
    expect(res2.body.lotId).toBe("MAD-001");
  });

  // -----------------------------------------------------------------------
  // Settlement
  // -----------------------------------------------------------------------

  it("settle fulfills a fulfilled payment", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
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
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    await srv
      .get("/premium/parking-report/MAD-001")
      .set("x-agentpay-receipt", JSON.stringify(receipt))
      .expect(200);

    await srv.post(`/demo/settle/${receipt.paymentId}`).expect(200);

    const res = await srv.post(`/demo/settle/${receipt.paymentId}`).expect(409);
    expect(res.body.message).toContain("DUPLICATE_SETTLEMENT");
  });

  it("non-fulfilled settlement is rejected (409)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const receipt = await authorizeAndSubmit(srv, requirement);

    const res = await srv.post(`/demo/settle/${receipt.paymentId}`).expect(409);
    expect(res.body.error).toBe("INVALID_STATE_TRANSITION");
  });

  // -----------------------------------------------------------------------
  // Audit
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Demo: authorize & submit helper
  // -----------------------------------------------------------------------

  it("POST /demo/authorize returns escrowed receipt and proof", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");

    const res = await srv
      .post("/demo/authorize")
      .send({ policyId: cfg.policyId, requirement, agentId: cfg.agentId })
      .expect(200);

    expect(res.body.authorization.paymentId).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.receipt.status).toBe("escrowed");
    expect(res.body.proof.kind).toBe("mock");
    expect(res.body.updatedPolicy.spentAmount).toBe(requirement.amount);
  });

  it("POST /demo/authorize ignores caller-supplied identity fields", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");

    const res = await srv
      .post("/demo/authorize")
      .send({
        policyId: "policy_attacker_001",
        requirement,
        agentId: "agent_attacker_001",
      })
      .expect(200);

    expect(res.body.authorization.policyId).toBe(cfg.policyId);
    expect(res.body.authorization.agentId).toBe(cfg.agentId);
  });

  it("POST /demo/authorize rejects a tampered requirement", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    const tampered = { ...requirement, amount: "1" };

    const res = await srv
      .post("/demo/authorize")
      .send({
        policyId: cfg.policyId,
        requirement: tampered,
        agentId: cfg.agentId,
      })
      .expect(403);

    expect(res.body.error).toBe("REQUIREMENT_MISMATCH");
  });

  // -----------------------------------------------------------------------
  // Setup is idempotent (resets state)
  // -----------------------------------------------------------------------

  it("POST /demo/setup resets state (2 audit events on fresh adapter)", async () => {
    const { srv } = await setup();
    const requirement = await get402Requirement(srv, "MAD-001");
    await authorizeAndSubmit(srv, requirement);

    const resetRes = await srv.post("/demo/setup").expect(200);
    // Fresh adapter with seedDemoData=false → 2 events (merchant + policy).
    expect(resetRes.body.auditEvents.length).toBe(2);

    const freshReq = await get402Requirement(srv);
    expect(freshReq.requestHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("real Testnet paid resource", () => {
  const signerKey = PrivateKey.generate(KeyAlgorithm.ED25519);
  const otherKey = PrivateKey.generate(KeyAlgorithm.ED25519);
  const secpKey = PrivateKey.generate(KeyAlgorithm.SECP256K1);
  const payee = PrivateKey.generate(KeyAlgorithm.ED25519).publicKey.toHex();
  const realConfig: PaidApiConfig = {
    ...cfg,
    mode: "casper-testnet",
    realPayee: payee,
    realAmountMotes: "2500000000",
    realSignerPublicKey: signerKey.publicKey.toHex(),
  };

  interface HeaderOptions {
    mutate?: (
      value: ReturnType<typeof buildCasperPaymentAuthorization>,
    ) => ReturnType<typeof buildCasperPaymentAuthorization>;
    authorizationHash?: string;
    signer?: string | null;
    signature?: string | null;
    signatureHash?: string;
    signatureKey?: PrivateKey;
    transactionHash?: string;
  }

  async function paymentHeader(
    requiredHeader: string,
    options: HeaderOptions = {},
  ) {
    const paymentRequired = decodePaymentRequiredHeader(requiredHeader);
    const guarded = normalizeX402PaymentRequired({
      paymentRequired,
      method: "GET",
      url: "http://127.0.0.1:4000/premium/rwa/parking-asset/MAD-001",
      body: {},
      agentId: cfg.agentId,
      endpointId: "rwa-parking-asset-MAD-001",
    });
    const issuedAuthorization = buildCasperPaymentAuthorization({
      request: guarded,
      agentId: cfg.agentId,
      decision: {
        allowed: true,
        decision: "ALLOW",
        policyId: cfg.policyId,
        merchantId: cfg.merchantId,
        checkedAt: new Date().toISOString(),
        checks: [],
        budgetBefore: guarded.amount,
        budgetAfter: "0",
      },
    });
    const authorization = options.mutate
      ? options.mutate(issuedAuthorization)
      : issuedAuthorization;
    const authorizationHash =
      options.authorizationHash ??
      createCasperPaymentAuthorizationHash(authorization);
    const signature =
      options.signature === null
        ? undefined
        : (options.signature ??
          Buffer.from(
            (options.signatureKey ?? signerKey).sign(
              Buffer.from(options.signatureHash ?? authorizationHash, "hex"),
            ),
          ).toString("hex"));
    const signer =
      options.signer === null
        ? undefined
        : (options.signer ?? signerKey.publicKey.toHex());
    const transactionHash = options.transactionHash ?? "aa".repeat(32);
    const payload: PaymentPayload = {
      x402Version: 2,
      resource: paymentRequired.resource,
      accepted: paymentRequired.accepts[0]!,
      payload: {
        authorization,
        authorizationHash,
        transactionHash,
        ...(signer ? { signer } : {}),
        ...(signature ? { authorizationSignature: signature } : {}),
      },
    };
    return {
      header: encodePaymentSignatureHeader(payload),
      authorization,
      authorizationHash,
      transactionHash,
    };
  }

  function observedTransfer(
    authorization: ReturnType<typeof buildCasperPaymentAuthorization>,
    transactionHash: string,
    changes: Partial<ObservedCasperTransfer> = {},
  ): ObservedCasperTransfer {
    return {
      transactionHash,
      executionStatus: "succeeded",
      network: authorization.network,
      signer: signerKey.publicKey.toHex(),
      destination: authorization.destination,
      amountMotes: authorization.amountMotes,
      transferId: authorization.transferId,
      ...changes,
    };
  }

  function verifiedServer(
    observed: Map<string, ObservedCasperTransfer>,
    consumed = new MemoryConsumedTransactionStore(),
  ) {
    const verifier = new CasperSettlementVerifier(
      { readTransfer: async (hash) => observed.get(hash) ?? null },
      consumed,
    );
    return request(
      createPaidApiServer(realConfig, {
        realPaymentVerifier: {
          verify: ({ authorization, authorizationHash, transactionHash }) =>
            verifier.verify({
              authorization,
              authorizationHash,
              transactionHash,
              expectedSigner: signerKey.publicKey.toHex(),
            }),
        },
      }),
    );
  }

  async function getRequirement(server: request.Agent) {
    return server.get("/premium/rwa/parking-asset/MAD-001").expect(402);
  }

  async function expectRejected(
    server: request.Agent,
    header: string,
    expectedCode: string,
  ) {
    const response = await server
      .get("/premium/rwa/parking-asset/MAD-001")
      .set("PAYMENT-SIGNATURE", header)
      .expect(403);
    expect(response.body.error).toBe(expectedCode);
    expect(response.body.lotId).toBeUndefined();
    expect(response.headers["payment-response"]).toBeUndefined();
  }

  it("returns official 402 and fails closed without an independent verifier", async () => {
    const server = request(createPaidApiServer(realConfig));
    const unpaid = await getRequirement(server);
    expect(unpaid.headers["payment-required"]).toBeTruthy();
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    const rejected = await server
      .get("/premium/rwa/parking-asset/MAD-001")
      .set("PAYMENT-SIGNATURE", payment.header)
      .expect(503);
    expect(rejected.body.error).toBe("SETTLEMENT_VERIFIER_UNAVAILABLE");
    expect(rejected.headers["payment-response"]).toBeUndefined();
  });

  it("valid current authorization and transaction succeeds idempotently", async () => {
    const observed = new Map<string, ObservedCasperTransfer>();
    const server = verifiedServer(observed);
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    observed.set(
      payment.transactionHash,
      observedTransfer(payment.authorization, payment.transactionHash),
    );
    const paid = await server
      .get("/premium/rwa/parking-asset/MAD-001")
      .set("PAYMENT-SIGNATURE", payment.header)
      .expect(200);
    expect(paid.body.lotId).toBe("MAD-001");
    expect(paid.headers["payment-response"]).toBeTruthy();
    const idempotent = await server
      .get("/premium/rwa/parking-asset/MAD-001")
      .set("PAYMENT-SIGNATURE", payment.header)
      .expect(200);
    expect(idempotent.headers["payment-response"]).toBeTruthy();
  });

  it.each([
    [
      "missing authorizationSignature",
      { signature: null },
      "AUTHORIZATION_SIGNATURE_INVALID",
    ],
    [
      "malformed authorizationSignature",
      { signature: "bad" },
      "AUTHORIZATION_SIGNATURE_INVALID",
    ],
    [
      "signature from another key",
      { signatureKey: otherKey },
      "AUTHORIZATION_SIGNATURE_INVALID",
    ],
    [
      "signature for another authorization",
      { signatureHash: "12".repeat(32) },
      "AUTHORIZATION_SIGNATURE_INVALID",
    ],
    [
      "wrong signer field",
      { signer: secpKey.publicKey.toHex() },
      "AUTHORIZATION_SIGNATURE_INVALID",
    ],
    [
      "modified authorizationHash",
      { authorizationHash: "34".repeat(32) },
      "AUTHORIZATION_HASH_MISMATCH",
    ],
  ] as const)("rejects %s", async (_label, options, code) => {
    const server = verifiedServer(new Map());
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
      options,
    );
    await expectRejected(server, payment.header, code);
  });

  const fieldMutations: Array<
    [
      string,
      (
        value: ReturnType<typeof buildCasperPaymentAuthorization>,
      ) => ReturnType<typeof buildCasperPaymentAuthorization>,
      string,
    ]
  > = [
    [
      "wrong policyId",
      (value) => ({ ...value, policyId: "other-policy" }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
    [
      "wrong agentId",
      (value) => ({ ...value, agentId: "other-agent" }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
    [
      "wrong merchantId",
      (value) => ({ ...value, merchantId: "other-merchant" }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
    [
      "wrong paymentId",
      (value) => ({ ...value, paymentId: "11".repeat(32) }),
      "PAYMENT_ID_MISMATCH",
    ],
    [
      "wrong transferId",
      (value) => ({ ...value, transferId: "7" }),
      "TRANSFER_ID_MISMATCH",
    ],
    [
      "wrong requirementHash",
      (value) => ({ ...value, requirementHash: "22".repeat(32) }),
      "REQUIREMENT_HASH_MISMATCH",
    ],
    [
      "wrong requestHash",
      (value) => ({ ...value, requestHash: "33".repeat(32) }),
      "AUTHORIZATION_REQUEST_MISMATCH",
    ],
    [
      "wrong bodyHash",
      (value) => ({ ...value, bodyHash: "44".repeat(32) }),
      "AUTHORIZATION_REQUEST_MISMATCH",
    ],
    [
      "wrong destination",
      (value) => ({ ...value, destination: otherKey.publicKey.toHex() }),
      "AUTHORIZATION_REQUEST_MISMATCH",
    ],
    [
      "wrong amount",
      (value) => ({ ...value, amountMotes: "2500000001" }),
      "AUTHORIZATION_REQUEST_MISMATCH",
    ],
    [
      "wrong nonce",
      (value) => ({ ...value, nonce: "other-nonce" }),
      "AUTHORIZATION_REQUEST_MISMATCH",
    ],
    [
      "wrong issuedAt",
      (value) => ({
        ...value,
        issuedAt: new Date(Date.parse(value.issuedAt) + 1).toISOString(),
      }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
    [
      "wrong expiresAt",
      (value) => ({
        ...value,
        expiresAt: new Date(Date.parse(value.expiresAt) + 1).toISOString(),
      }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
    [
      "wrong facilitator",
      (value) => ({ ...value, facilitator: "https://other.example.test" }),
      "AUTHORIZATION_FIELD_MISMATCH",
    ],
  ];

  it.each(fieldMutations)("rejects %s", async (_label, mutate, code) => {
    const server = verifiedServer(new Map());
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
      { mutate },
    );
    await expectRejected(server, payment.header, code);
  });

  it("rejects an expired authorization", async () => {
    const server = verifiedServer(new Map());
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
      {
        mutate: (value) => ({
          ...value,
          issuedAt: "2020-01-01T00:00:00.000Z",
          expiresAt: "2020-01-01T00:05:00.000Z",
        }),
      },
    );
    await expectRejected(server, payment.header, "AUTHORIZATION_EXPIRED");
  });

  it("modified authorization after signing is rejected against server terms", async () => {
    const server = verifiedServer(new Map());
    const unpaid = await getRequirement(server);
    const original = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
      {
        mutate: (value) => ({ ...value, policyId: "forged-policy" }),
        signatureHash: original.authorizationHash,
      },
    );
    await expectRejected(
      server,
      payment.header,
      "AUTHORIZATION_FIELD_MISMATCH",
    );
  });

  it("unrelated historical transfer cannot unlock a new payment requirement", async () => {
    const observed = new Map<string, ObservedCasperTransfer>();
    const server = verifiedServer(observed);
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    observed.set(
      payment.transactionHash,
      observedTransfer(payment.authorization, payment.transactionHash, {
        transferId: "1",
      }),
    );
    await expectRejected(server, payment.header, "SETTLEMENT_NOT_VERIFIED");
  });

  it("forged matching authorization cannot reuse a historical same-payee transfer", async () => {
    const observed = new Map<string, ObservedCasperTransfer>();
    const server = verifiedServer(observed);
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
      { mutate: (value) => ({ ...value, transferId: "1" }) },
    );
    observed.set(
      payment.transactionHash,
      observedTransfer(payment.authorization, payment.transactionHash),
    );
    await expectRejected(server, payment.header, "TRANSFER_ID_MISMATCH");
  });

  it("rejects a transaction consumed by another authorization", async () => {
    const consumed = new MemoryConsumedTransactionStore();
    const observed = new Map<string, ObservedCasperTransfer>();
    const server = verifiedServer(observed, consumed);
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    await consumed.consume(payment.transactionHash, "ff".repeat(32));
    observed.set(
      payment.transactionHash,
      observedTransfer(payment.authorization, payment.transactionHash),
    );
    await expectRejected(server, payment.header, "SETTLEMENT_NOT_VERIFIED");
  });

  it("never generates premium data before complete verification", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("RPC unavailable"));
    const server = request(
      createPaidApiServer(realConfig, {
        realPaymentVerifier: { verify },
      }),
    );
    const unpaid = await getRequirement(server);
    const payment = await paymentHeader(
      unpaid.headers["payment-required"] as string,
    );
    const response = await server
      .get("/premium/rwa/parking-asset/MAD-001")
      .set("PAYMENT-SIGNATURE", payment.header)
      .expect(403);
    expect(verify).toHaveBeenCalledOnce();
    expect(response.body.lotId).toBeUndefined();
    expect(response.headers["payment-response"]).toBeUndefined();
  });
});
