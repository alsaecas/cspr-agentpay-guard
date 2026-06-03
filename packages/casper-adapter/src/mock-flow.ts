import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  computePaymentId,
  computeRequestHash,
  type PaymentAuthorization,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";

import { createCasperPaymentAdapter } from "./factory";

export interface MockPaymentFlowResult {
  mode: "mock" | "casper-testnet";
  requirement: PaymentRequirement;
  authorization: PaymentAuthorization;
  receiptDeployHash: string;
  settlementDeployHash: string;
}

export async function runMockPaymentFlow(): Promise<MockPaymentFlowResult> {
  const adapter = createCasperPaymentAdapter({ mode: "mock" });
  const now = new Date("2026-06-03T00:00:00.000Z");
  const expiresAt = new Date("2026-06-03T00:05:00.000Z").toISOString();
  const agentId = process.env.AGENT_ID ?? "agent_research_001";
  const merchantId = process.env.MERCHANT_ID ?? "merchant_market_data_001";
  const amount = "1000000000";
  const requestHash = computeRequestHash({
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    resourceId: "premium-report-cspr",
    merchantId,
    agentId,
    body: {},
    headers: {
      "content-type": "application/json",
      "x-agent-id": agentId,
      "x-merchant-id": merchantId,
      "x-resource-id": "premium-report-cspr",
    },
  });

  const requirement: PaymentRequirement = {
    version: PROTOCOL_VERSION,
    requirementId: "req_mock_001",
    merchantId,
    merchantAccount: "mock-merchant-account",
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    resourceId: "premium-report-cspr",
    amount,
    currency: "CSPR",
    requestHash,
    requirementNonce: "mock-requirement-nonce-001",
    termsHash: blake2b256Hex("mock terms"),
    escrowMode: "authorize_then_settle",
    expiresAt,
    issuedAt: now.toISOString(),
  };

  const authorizationNonce = "mock-authorization-nonce-001";
  const paymentId = computePaymentId({
    policyId: "policy_demo_agent_001",
    agentId,
    merchantId,
    requirementId: requirement.requirementId,
    requestHash,
    amount,
    currency: "CSPR",
    requirementNonce: requirement.requirementNonce,
    authorizationNonce,
  });

  const authorization: PaymentAuthorization = {
    version: PROTOCOL_VERSION,
    paymentId,
    policyId: "policy_demo_agent_001",
    agentId,
    merchantId,
    requirementId: requirement.requirementId,
    requestHash,
    amount,
    currency: "CSPR",
    authorizationNonce,
    expiresAt,
    authorizedAt: new Date("2026-06-03T00:00:10.000Z").toISOString(),
    signature: "mock-agent-signature",
  };

  const receipt = await adapter.submitPayment({
    requirement,
    authorization,
    now: new Date("2026-06-03T00:00:20.000Z"),
  });
  const settlement = await adapter.settlePayment({
    paymentId,
    now: new Date("2026-06-03T00:00:30.000Z"),
  });

  return {
    mode: adapter.mode,
    requirement,
    authorization,
    receiptDeployHash: receipt.casperDeployHash,
    settlementDeployHash: settlement.casperDeployHash,
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
    "premium data released after request-bound receipt verification",
  ].join("\n");
}
