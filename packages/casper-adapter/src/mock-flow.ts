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
  const now = new Date("2026-06-03T00:00:00.000Z");
  const expiresAt = new Date("2026-06-03T00:05:00.000Z").toISOString();
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
    expiresAt: "2026-06-04T00:00:00.000Z",
    policyNonce: "policy-nonce-001",
    createdAt: now.toISOString(),
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
    createdAt: now.toISOString(),
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
    expiresAt,
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
    expiresAt,
    issuedAt: now.toISOString(),
  };

  const authorizationResult = await adapter.authorizePayment({
    policyId: "policy_demo_agent_001",
    requirement,
    request,
    authorizationNonce: "mock-payment-nonce-001",
    now: new Date("2026-06-03T00:00:10.000Z"),
  });
  const receipt = await adapter.submitPayment({
    paymentId: authorizationResult.authorization.paymentId,
    now: new Date("2026-06-03T00:00:20.000Z"),
  });
  await adapter.markFulfilled({
    paymentId: authorizationResult.authorization.paymentId,
    responseBody: { symbol: "CSPR", signal: "premium-placeholder" },
    now: new Date("2026-06-03T00:00:25.000Z"),
  });
  const settlement = await adapter.settlePayment({
    paymentId: authorizationResult.authorization.paymentId,
    now: new Date("2026-06-03T00:00:30.000Z"),
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
