import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  type AgentPolicy,
  type AuditEvent,
  type Merchant,
  type PaymentAuthorization,
  type PaymentRequirement,
  type CasperProof,
} from "@cspr-agentpay/protocol";

import { MockCasperPaymentAdapter } from "./mock";

export interface MockPaymentFlowResult {
  mode: "mock" | "casper-testnet";
  requirement: PaymentRequirement;
  authorization: PaymentAuthorization;
  receiptDeployHash: string;
  settlementDeployHash: string;
  auditEvents: AuditEvent[];
}

export async function runMockPaymentFlow(): Promise<MockPaymentFlowResult> {
  const adapter = new MockCasperPaymentAdapter({
    seedDemoData: false,
  });

  // Use dynamic relative timestamps so the demo always runs against the
  // current wall clock.  Offsets preserve the same relative spacing that
  // the fixed-date fixture used for deterministic output verification.
  const baseNow = new Date();
  const policyExpiresAt = new Date(
    baseNow.getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  const requirementExpiresAt = new Date(
    baseNow.getTime() + 5 * 60 * 1000,
  ).toISOString();

  const agentId = process.env.AGENT_ID ?? "agent_research_001";
  const merchantId = process.env.MERCHANT_ID ?? "merchant_market_data_001";
  const merchantAccount = "mock-merchant-account";
  const endpointId = "premium-report-cspr";
  const amount = "1000000000";
  const requestNonce = "mock-requirement-nonce-001";

  const policy: AgentPolicy = {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo_agent_001",
    ownerAccount: "mock-owner-account",
    agentId,
    status: "active",
    currency: "CSPR",
    maxAmountPerPayment: "2500000000",
    totalBudget: "10000000000",
    spentAmount: "0",
    budgetWindow: "demo-total",
    allowedMerchantIds: [merchantId],
    allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
    expiresAt: policyExpiresAt,
    policyNonce: "policy-nonce-001",
    createdAt: baseNow.toISOString(),
  };
  const merchant: Merchant = {
    version: PROTOCOL_VERSION,
    merchantId,
    displayName: "Market Data Merchant",
    status: "active",
    casperAccount: merchantAccount,
    settlementAccount: merchantAccount,
    allowedOrigins: ["https://api.example.test"],
    allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
    createdAt: baseNow.toISOString(),
  };

  await adapter.registerMerchant(merchant);
  await adapter.createPolicy(policy);

  const request = {
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    bodyHash: createBodyHash({}),
    endpointId,
    merchantId,
    agentId,
    nonce: requestNonce,
    expiresAt: requirementExpiresAt,
  };
  const requestHash = createRequestHash(request);

  const requirement: PaymentRequirement = {
    version: PROTOCOL_VERSION,
    requirementId: "req_mock_001",
    merchantId,
    merchantAccount,
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    endpointId,
    amount,
    currency: "CSPR",
    requestHash,
    nonce: requestNonce,
    termsHash: blake2b256Hex("mock terms"),
    escrowMode: "authorize_then_settle",
    expiresAt: requirementExpiresAt,
    issuedAt: baseNow.toISOString(),
  };

  const authorizationResult = await adapter.authorizePayment({
    policyId: "policy_demo_agent_001",
    requirement,
    request,
    authorizationNonce: "mock-payment-nonce-001",
    now: new Date(baseNow.getTime() + 10_000),
  });
  const receipt = await adapter.submitPayment({
    paymentId: authorizationResult.authorization.paymentId,
    now: new Date(baseNow.getTime() + 20_000),
  });
  await adapter.markFulfilled({
    paymentId: authorizationResult.authorization.paymentId,
    responseBody: { symbol: "CSPR", signal: "premium-placeholder" },
    now: new Date(baseNow.getTime() + 25_000),
  });
  const settlement = await adapter.settlePayment({
    paymentId: authorizationResult.authorization.paymentId,
    now: new Date(baseNow.getTime() + 30_000),
  });
  const auditEvents = await adapter.listAuditEvents();

  return {
    mode: adapter.mode,
    requirement,
    authorization: authorizationResult.authorization,
    receiptDeployHash:
      receipt.casperDeployHash ?? proofDisplayHash(receipt.proof),
    settlementDeployHash:
      settlement.casperDeployHash ?? proofDisplayHash(settlement.proof),
    auditEvents,
  };
}

export function formatMockPaymentFlow(result: MockPaymentFlowResult): string {
  return [
    "CSPR AgentPay Guard mock demo succeeded",
    `mode=${result.mode}`,
    "agent received 402 Payment Required",
    `requestHash=${result.requirement.requestHash}`,
    `paymentId=${result.authorization.paymentId}`,
    `receipt=${result.receiptDeployHash}`,
    `settlement=${result.settlementDeployHash}`,
    "audit timeline:",
    ...result.auditEvents.map(
      (event) =>
        `- ${event.createdAt} ${event.type}${event.paymentId ? ` paymentId=${event.paymentId}` : ""}`,
    ),
    "premium data released after request-bound receipt verification",
  ].join("\n");
}

function proofDisplayHash(proof: CasperProof): string {
  if (proof.kind === "mock") {
    return proof.hash;
  }
  if (proof.kind === "transaction-v1") {
    return proof.transactionHash;
  }
  return proof.deployHash;
}
