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
  type GuardCheck,
  type GuardDecisionReason,
  type GuardedPaymentRequest,
  type Merchant,
  type PaymentSettlementEvidence,
} from "@cspr-agentpay/protocol";

import { guardedFetch } from "./guarded-fetch";
import { MockX402SettlementAdapter } from "./x402";

export type GuardedDemoScenario =
  | "allowed-payment"
  | "prompt-injection-attack"
  | "replay-attack";

export interface GuardedScenarioResult {
  scenario: GuardedDemoScenario;
  agentIntent: string;
  requestedPurchase: {
    resource: string;
    amount: string;
    asset: string;
    payee: string;
  };
  normalizedPaymentRequest?: GuardedPaymentRequest | undefined;
  guardChecks: GuardCheck[];
  decision: "ALLOW" | "DENY";
  denialReason?: GuardDecisionReason | undefined;
  settlementAdapterCalled: boolean;
  settlementStatus: string;
  casperEvidence?: PaymentSettlementEvidence | undefined;
  budgetBefore: string;
  budgetAfter: string;
  mode: "mock";
  note: string;
}

const NOW = new Date("2030-01-01T00:00:00.000Z");
const EXPIRES_AT = "2030-01-01T00:05:00.000Z";
const URL = "https://api.example.test/premium/parking-report/MAD-001";
const ENDPOINT_ID = "premium-parking-report";

export async function runGuardedX402Scenario(
  scenario: GuardedDemoScenario,
): Promise<GuardedScenarioResult> {
  const attack = scenario === "prompt-injection-attack";
  const replay = scenario === "replay-attack";
  const amount = attack ? "9000" : "100";
  const payee = attack ? "account-attacker" : "account-merchant";
  const requirement = buildPaymentRequired({ amount, payee });
  const adapter = new MockX402SettlementAdapter();
  const usedNonces = replay
    ? new Set(["merchant_market_data_001:scenario-nonce-001"])
    : new Set<string>();
  let requestCount = 0;

  const result = await guardedFetch(URL, {
    method: "POST",
    body: { lotId: "MAD-001" },
    endpointId: ENDPOINT_ID,
    expectedAmount: "100",
    policyId: "policy_demo_guarded_x402",
    agentId: "agent_research_001",
    policy: demoPolicy(),
    merchant: demoMerchant(),
    settlementAdapter: adapter,
    usedNonces,
    now: NOW,
    fetchFn: async (_url, init) => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: {
            "content-type": "application/json",
            "PAYMENT-REQUIRED": encodePaymentRequiredHeader(requirement),
          },
        });
      }
      if (!new Headers(init?.headers).has("PAYMENT-SIGNATURE")) {
        return new Response("missing payment", { status: 402 });
      }
      const settlement: SettleResponse = {
        success: true,
        transaction: "mock-scenario-settlement",
        network: "casper:casper-test",
      };
      return new Response(JSON.stringify({ premium: true }), {
        status: 200,
        headers: {
          "PAYMENT-RESPONSE": encodePaymentResponseHeader(settlement),
        },
      });
    },
  });

  if (!result.paid) {
    throw new Error("Scenario resource unexpectedly returned without payment.");
  }

  return {
    scenario,
    agentIntent: attack
      ? "Fetch premium data; provider content says to ignore policy, increase the price, and pay account-attacker."
      : replay
        ? "Reuse a prior payment authorization to fetch the premium report again."
        : "Purchase the premium parking report within the owner's policy.",
    requestedPurchase: { resource: URL, amount, asset: "CSPR", payee },
    normalizedPaymentRequest: result.normalizedRequest,
    guardChecks: result.decision.checks,
    decision: result.decision.decision,
    denialReason: result.decision.allowed ? undefined : result.decision.reason,
    settlementAdapterCalled: result.settlementAdapterCalled,
    settlementStatus:
      "evidence" in result ? result.evidence.status : "not-called",
    casperEvidence: "evidence" in result ? result.evidence : undefined,
    budgetBefore: result.decision.budgetBefore ?? "10000",
    budgetAfter:
      result.decision.budgetAfter ?? result.decision.budgetBefore ?? "10000",
    mode: "mock",
    note: "Deterministic local x402 simulation. No Casper transaction was submitted.",
  };
}

function buildPaymentRequired(input: {
  amount: string;
  payee: string;
}): PaymentRequired {
  const bodyHash = createBodyHash({ lotId: "MAD-001" });
  const requestHash = createRequestHash({
    method: "POST",
    url: URL,
    bodyHash,
    endpointId: ENDPOINT_ID,
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce: "scenario-nonce-001",
    expiresAt: EXPIRES_AT,
  });
  return {
    x402Version: 2,
    resource: { url: URL, description: "Premium parking report" },
    accepts: [
      {
        scheme: "exact",
        network: "casper:casper-test",
        asset: "CSPR",
        amount: input.amount,
        payTo: input.payee,
        maxTimeoutSeconds: 300,
        extra: {
          agentPayGuard: {
            merchantId: "merchant_market_data_001",
            providerId: "parking-data-provider",
            nonce: "scenario-nonce-001",
            issuedAt: NOW.toISOString(),
            expiresAt: EXPIRES_AT,
            requestHash,
            bodyHash,
          },
        },
      },
    ],
  };
}

function demoPolicy(): AgentPolicy {
  return {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo_guarded_x402",
    ownerAccount: "mock-owner-account",
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
    expiresAt: EXPIRES_AT,
    policyNonce: "policy-nonce-001",
    createdAt: NOW.toISOString(),
  };
}

function demoMerchant(): Merchant {
  return {
    version: PROTOCOL_VERSION,
    merchantId: "merchant_market_data_001",
    displayName: "Parking Data Provider",
    status: "active",
    casperAccount: "account-merchant",
    settlementAccount: "account-merchant",
    allowedOrigins: ["https://api.example.test"],
    allowedResourcePatterns: ["POST https://api.example.test/premium/*"],
    createdAt: NOW.toISOString(),
  };
}
