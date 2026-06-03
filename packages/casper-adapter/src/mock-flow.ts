import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  type PaymentAuthorization,
  type PaymentRequirement,
  type CasperProof,
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
  const merchantAccount = "mock-merchant-account";
  const endpointId = "premium-report-cspr";
  const amount = "1000000000";
  const requestNonce = "mock-requirement-nonce-001";
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

  return {
    mode: adapter.mode,
    requirement,
    authorization: authorizationResult.authorization,
    receiptDeployHash:
      receipt.casperDeployHash ?? proofDisplayHash(receipt.proof),
    settlementDeployHash:
      settlement.casperDeployHash ?? proofDisplayHash(settlement.proof),
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

function proofDisplayHash(proof: CasperProof): string {
  if (proof.kind === "mock") {
    return proof.hash;
  }
  if (proof.kind === "transaction-v1") {
    return proof.transactionHash;
  }
  return proof.deployHash;
}
