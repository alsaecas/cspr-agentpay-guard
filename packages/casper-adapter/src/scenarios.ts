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
  | "prompt-injection-payee-substitution"
  | "amount-escalation"
  | "resource-substitution"
  | "expired-requirement"
  | "replay-attack"
  | "replay-attempt";

export interface GuardedScenarioOptions {
  expectedPayee?: string;
  expectedAmount?: string;
  settlementAdapter?: NoSpendX402SettlementAdapter;
}

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
  mockAuthorizationCalled: boolean;
  signerCalled: boolean;
  submissionCalled: boolean;
  settlementStatus: string;
  casperEvidence?: PaymentSettlementEvidence | undefined;
  budgetBefore: string;
  budgetAfter: string;
  premiumResponse?: Record<string, unknown> | undefined;
  demoPremiumResourceReleased: boolean;
  adapterCalls: {
    inspect: number;
    authorize: number;
    settle: number;
    verify: number;
  };
  mode: "mock-no-spend";
  note: string;
}

/**
 * Explicit judge adapter. It exercises x402 authorization and response
 * verification but has no signer, submitter, facilitator, RPC, or key reader.
 */
export class NoSpendX402SettlementAdapter extends MockX402SettlementAdapter {
  readonly signerCalls = 0;
  readonly submissionCalls = 0;
}

const NOW = new Date("2030-01-01T00:00:00.000Z");
const EXPIRES_AT = "2030-01-01T00:05:00.000Z";
const EXPIRED_AT = "2029-12-31T23:59:59.000Z";
const URL = "https://api.example.test/premium/rwa/parking-asset/MAD-001";
const SUBSTITUTED_URL =
  "https://api.example.test/unapproved/rwa/parking-asset/MAD-001";
const ENDPOINT_ID = "premium-rwa-parking-asset-MAD-001";
const DEFAULT_PAYEE = "account-merchant";
const ATTACKER_PAYEE = `01${"ff".repeat(32)}`;
const DEFAULT_AMOUNT = "100";
const NONCE = "scenario-nonce-001";
const BODY = { assetId: "MAD-001", report: "due-diligence" };

export async function runGuardedX402Scenario(
  scenario: GuardedDemoScenario,
  options: GuardedScenarioOptions = {},
): Promise<GuardedScenarioResult> {
  const canonical = canonicalScenario(scenario);
  const expectedPayee = options.expectedPayee ?? DEFAULT_PAYEE;
  const expectedAmount = options.expectedAmount ?? DEFAULT_AMOUNT;
  const requestedPayee =
    canonical === "prompt-injection-payee-substitution"
      ? ATTACKER_PAYEE
      : expectedPayee;
  const requestedAmount =
    canonical === "amount-escalation"
      ? (BigInt(expectedAmount) + 1n).toString()
      : expectedAmount;
  const requestedUrl =
    canonical === "resource-substitution" ? SUBSTITUTED_URL : URL;
  const expiresAt =
    canonical === "expired-requirement" ? EXPIRED_AT : EXPIRES_AT;
  const requirement = buildPaymentRequired({
    amount: requestedAmount,
    payee: requestedPayee,
    url: requestedUrl,
    expiresAt,
  });
  const adapter =
    options.settlementAdapter ?? new NoSpendX402SettlementAdapter();
  const usedNonces =
    canonical === "replay-attempt"
      ? new Set([`merchant_market_data_001:${NONCE}`])
      : new Set<string>();
  let requestCount = 0;

  const result = await guardedFetch(requestedUrl, {
    method: "POST",
    body: BODY,
    endpointId: ENDPOINT_ID,
    expectedAmount:
      canonical === "amount-escalation" ? requestedAmount : expectedAmount,
    expectedPayee,
    policyId: "policy_demo_guarded_x402",
    agentId: "agent_research_001",
    policy: demoPolicy({ expectedPayee, expectedAmount }),
    merchant: demoMerchant(expectedPayee),
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
        transaction: "a".repeat(64),
        network: "casper:casper-test",
      };
      return new Response(
        JSON.stringify({
          premium: true,
          assetId: "MAD-001",
          assetType: "tokenized-parking",
          location: "Madrid",
          occupancyRate: 0.87,
          riskRating: "LOW",
          report: "Deterministic RWA due-diligence response",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "PAYMENT-RESPONSE": encodePaymentResponseHeader(settlement),
          },
        },
      );
    },
  });

  if (!result.paid) {
    throw new Error("Scenario resource unexpectedly returned without payment.");
  }

  const premiumResponse =
    result.decision.allowed
      ? ((await result.response.clone().json()) as Record<string, unknown>)
      : undefined;

  return {
    scenario,
    agentIntent: agentIntent(canonical),
    requestedPurchase: {
      resource: requestedUrl,
      amount: requestedAmount,
      asset: "CSPR",
      payee: requestedPayee,
    },
    normalizedPaymentRequest: result.normalizedRequest,
    guardChecks: result.decision.checks,
    decision: result.decision.decision,
    denialReason: result.decision.allowed ? undefined : result.decision.reason,
    settlementAdapterCalled: result.settlementAdapterCalled,
    mockAuthorizationCalled: adapter.calls.authorize > 0,
    signerCalled: adapter.signerCalls > 0,
    submissionCalled: adapter.submissionCalls > 0,
    settlementStatus: "evidence" in result ? result.evidence.status : "not-called",
    casperEvidence: "evidence" in result ? result.evidence : undefined,
    budgetBefore: result.decision.budgetBefore ?? "0",
    budgetAfter:
      result.decision.budgetAfter ?? result.decision.budgetBefore ?? "0",
    premiumResponse,
    demoPremiumResourceReleased:
      result.decision.allowed &&
      result.response.status === 200 &&
      premiumResponse?.assetId === "MAD-001",
    adapterCalls: { ...adapter.calls },
    mode: "mock-no-spend",
    note:
      "Actual guardedFetch policy and x402 retry executed with an injected no-spend adapter. No signer, submitter, facilitator, RPC, or key reader exists in this flow.",
  };
}

function canonicalScenario(scenario: GuardedDemoScenario) {
  if (scenario === "prompt-injection-attack") {
    return "prompt-injection-payee-substitution" as const;
  }
  if (scenario === "replay-attack") return "replay-attempt" as const;
  return scenario;
}

function agentIntent(
  scenario: ReturnType<typeof canonicalScenario>,
): string {
  switch (scenario) {
    case "prompt-injection-payee-substitution":
      return "Fetch MAD-001; malicious provider text attempts to replace the authoritative payee.";
    case "amount-escalation":
      return "Fetch MAD-001 after a requirement escalates above the policy payment limit.";
    case "resource-substitution":
      return "Reuse the task intent for an unapproved resource URL.";
    case "expired-requirement":
      return "Attempt to use an expired server-issued payment requirement.";
    case "replay-attempt":
      return "Reuse a previously consumed requirement nonce.";
    default:
      return "Purchase the premium MAD-001 RWA due-diligence report within policy.";
  }
}

function buildPaymentRequired(input: {
  amount: string;
  payee: string;
  url: string;
  expiresAt: string;
}): PaymentRequired {
  const bodyHash = createBodyHash(BODY);
  const requestHash = createRequestHash({
    method: "POST",
    url: input.url,
    bodyHash,
    endpointId: ENDPOINT_ID,
    merchantId: "merchant_market_data_001",
    agentId: "agent_research_001",
    nonce: NONCE,
    expiresAt: input.expiresAt,
  });
  return {
    x402Version: 2,
    resource: { url: input.url, description: "Premium MAD-001 RWA report" },
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
            nonce: NONCE,
            issuedAt: NOW.toISOString(),
            expiresAt: input.expiresAt,
            requestHash,
            bodyHash,
          },
        },
      },
    ],
  };
}

function demoPolicy(input: {
  expectedPayee: string;
  expectedAmount: string;
}): AgentPolicy {
  return {
    version: PROTOCOL_VERSION,
    policyId: "policy_demo_guarded_x402",
    ownerAccount: "mock-owner-account",
    agentId: "agent_research_001",
    status: "active",
    currency: "CSPR",
    maxAmountPerPayment: input.expectedAmount,
    totalBudget: (BigInt(input.expectedAmount) * 4n).toString(),
    spentAmount: "0",
    budgetWindow: "demo-total",
    allowedMerchantIds: ["merchant_market_data_001"],
    allowedResourcePatterns: [
      "POST https://api.example.test/premium/rwa/parking-asset/*",
    ],
    allowedNetworks: ["casper:casper-test"],
    allowedAssets: ["CSPR"],
    allowedPayees: [input.expectedPayee],
    expiresAt: EXPIRES_AT,
    policyNonce: "policy-nonce-001",
    createdAt: NOW.toISOString(),
  };
}

function demoMerchant(expectedPayee: string): Merchant {
  return {
    version: PROTOCOL_VERSION,
    merchantId: "merchant_market_data_001",
    displayName: "Parking Data Provider",
    status: "active",
    casperAccount: expectedPayee,
    settlementAccount: expectedPayee,
    allowedOrigins: ["https://api.example.test"],
    allowedResourcePatterns: [
      "POST https://api.example.test/premium/rwa/parking-asset/*",
    ],
    createdAt: NOW.toISOString(),
  };
}
