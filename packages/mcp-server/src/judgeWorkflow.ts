import {
  runGuardedX402Scenario,
  type GuardedDemoScenario,
} from "@cspr-agentpay/casper-adapter";

import evidence from "../../../docs/evidence/first-guarded-testnet-payment.json";

export const JUDGE_SCENARIOS = [
  "allowed-payment",
  "prompt-injection-payee-substitution",
  "amount-escalation",
  "resource-substitution",
  "expired-requirement",
  "replay-attempt",
] as const;

export type JudgeScenario = (typeof JUDGE_SCENARIOS)[number];

const NO_SPEND_NOTE =
  "Actual guardedFetch policy and x402 retry run with an injected no-spend adapter. No signer, submitter, facilitator, RPC, or key reader is constructed.";

export async function evaluatePaymentScenario(scenario: JudgeScenario) {
  const result = await runGuardedX402Scenario(
    scenario as GuardedDemoScenario,
    {
      expectedPayee: evidence.payee,
      expectedAmount: evidence.amountMotes,
    },
  );

  return {
    scenario,
    decision: result.decision,
    reasonCode: result.denialReason ?? "POLICY_ALLOW",
    orderedChecks: result.guardChecks,
    normalizedRequirement: result.normalizedPaymentRequest,
    expectedPayee: evidence.payee,
    expectedPayeeAccountHash: evidence.payeeAccountHash,
    requestedPayee: result.normalizedPaymentRequest?.payee,
    expectedAmount: evidence.amountMotes,
    requestedAmount: result.normalizedPaymentRequest?.amount,
    settlementAdapterCalled: result.settlementAdapterCalled,
    mockAuthorizationCalled: result.mockAuthorizationCalled,
    signerCalled: result.signerCalled,
    submissionCalled: result.submissionCalled,
    budgetBeforeMotes: result.budgetBefore,
    budgetAfterMotes: result.budgetAfter,
    budgetDeltaMotes: (
      BigInt(result.budgetBefore) - BigInt(result.budgetAfter)
    ).toString(),
    demoPremiumResponse: result.premiumResponse,
    demoPremiumResourceReleased: result.demoPremiumResourceReleased,
    adapterCalls: result.adapterCalls,
    mode: result.mode,
    noSpendStatement: NO_SPEND_NOTE,
  } as const;
}

export async function runRwaDueDiligence() {
  const result = await evaluatePaymentScenario("allowed-payment");
  const normalized = result.normalizedRequirement;
  if (!normalized) throw new Error("Guarded flow did not normalize the requirement.");

  return {
    agentTask:
      "Get the premium MAD-001 tokenized parking asset due-diligence report.",
    protectedResourceRequest: {
      method: normalized.method,
      url: normalized.url,
      assetId: "MAD-001",
    },
    http402Requirement: {
      status: 402,
      transport: "x402 v2 PAYMENT-REQUIRED",
      amountMotes: normalized.amount,
      payee: normalized.payee,
    },
    normalizedRequirement: normalized,
    orderedPolicyChecks: result.orderedChecks,
    decision: result.decision,
    reasonCode: result.reasonCode,
    settlementAdapterCalled: result.settlementAdapterCalled,
    mockAuthorizationCalled: result.mockAuthorizationCalled,
    signerCalled: result.signerCalled,
    submissionCalled: result.submissionCalled,
    budgetBeforeMotes: result.budgetBeforeMotes,
    budgetAfterMotes: result.budgetAfterMotes,
    demoPremiumResponse: result.demoPremiumResponse,
    demoPremiumResourceReleased: result.demoPremiumResourceReleased,
    verifiedTestnetPremiumResourceReleased: evidence.premiumResourceReleased,
    mode: result.mode,
    boundaryNote:
      `${NO_SPEND_NOTE} The verified Testnet release is separate historical public evidence.`,
  } as const;
}

export function getVerifiedTestnetPayment() {
  return {
    transactionHash: evidence.transactionHash,
    network: evidence.network,
    amountMotes: evidence.amountMotes,
    amountCSPR: "2.5",
    block: evidence.blockHeight,
    signerAccountHash: evidence.signerAccountHash,
    payee: evidence.payee,
    payeeAccountHash: evidence.payeeAccountHash,
    timestamp: evidence.transactionTimestamp,
    executionStatus: evidence.executionStatus,
    explorerUrl: evidence.explorerUrl,
    paymentResponseVerified: evidence.paymentResponseVerified,
    verifiedTestnetPremiumResourceReleased: evidence.premiumResourceReleased,
    proofRecorderSeparationNote:
      "The Odra proof-recorder transaction is a separate public audit proof, not payment settlement, escrow, or custody.",
  } as const;
}

export function getSecurityModel() {
  return {
    invariants: [
      "Model output cannot select an arbitrary payee.",
      "The server-issued payment requirement is authoritative.",
      "Exact request and body hashes are checked.",
      "Merchant, tagged payee, resource, amount, budget, integrity, and expiry limits run before signing.",
      "Unknown execution state never becomes success.",
      "Transaction and receipt replay are rejected.",
      "Hosted mode injects a no-spend adapter and constructs no signer, submitter, facilitator, RPC, or key reader.",
    ],
  } as const;
}
