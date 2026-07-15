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

const EXPECTED_PAYEE = evidence.payeeAccountHash;
const EXPECTED_AMOUNT = evidence.amountMotes;
const RESOURCE = "https://provider.example/premium/rwa/parking-asset/MAD-001";

const baseChecks = [
  "requirement_integrity",
  "merchant_allowlist",
  "payee_binding",
  "resource_binding",
  "amount_limit",
  "budget_limit",
  "expiry",
  "request_hash",
  "replay_status",
] as const;

const failures: Record<Exclude<JudgeScenario, "allowed-payment">, {
  code: string;
  failedCheck: (typeof baseChecks)[number];
  requestedPayee?: string;
  requestedAmount?: string;
}> = {
  "prompt-injection-payee-substitution": {
    code: "PAYEE_MISMATCH",
    failedCheck: "payee_binding",
    requestedPayee: "attacker-controlled-account-hash",
  },
  "amount-escalation": {
    code: "AMOUNT_LIMIT_EXCEEDED",
    failedCheck: "amount_limit",
    requestedAmount: "25000000000",
  },
  "resource-substitution": {
    code: "RESOURCE_MISMATCH",
    failedCheck: "resource_binding",
  },
  "expired-requirement": {
    code: "REQUIREMENT_EXPIRED",
    failedCheck: "expiry",
  },
  "replay-attempt": {
    code: "TRANSACTION_REPLAYED",
    failedCheck: "replay_status",
  },
};

export function evaluatePaymentScenario(scenario: JudgeScenario) {
  const failure = scenario === "allowed-payment" ? null : failures[scenario];
  const orderedChecks = baseChecks.map((check) => ({
    check,
    status: failure?.failedCheck === check ? "FAIL" : "PASS",
  }));
  const allowed = failure === null;

  return {
    scenario,
    decision: allowed ? "ALLOW" : "DENY",
    reasonCode: allowed ? "POLICY_ALLOW" : failure.code,
    orderedChecks,
    expectedPayee: EXPECTED_PAYEE,
    requestedPayee: failure?.requestedPayee ?? EXPECTED_PAYEE,
    expectedAmount: EXPECTED_AMOUNT,
    requestedAmount: failure?.requestedAmount ?? EXPECTED_AMOUNT,
    signerCalled: false,
    submissionCalled: false,
    budgetDeltaMotes: allowed ? EXPECTED_AMOUNT : "0",
    noSpendStatement:
      "Judge mode is deterministic and no-spend: no signer, key, or Casper submitter is invoked.",
  } as const;
}

export function runRwaDueDiligence() {
  const evaluation = evaluatePaymentScenario("allowed-payment");
  return {
    agentTask: "Get the premium MAD-001 tokenized parking asset due-diligence report.",
    protectedResourceRequest: { method: "GET", url: RESOURCE, assetId: "MAD-001" },
    http402Requirement: {
      status: 402,
      transport: "x402 v2 PAYMENT-REQUIRED",
      amountMotes: EXPECTED_AMOUNT,
      payeeAccountHash: EXPECTED_PAYEE,
    },
    normalizedRequirement: {
      assetId: "MAD-001",
      method: "GET",
      resource: RESOURCE,
      amountMotes: EXPECTED_AMOUNT,
      payeeAccountHash: EXPECTED_PAYEE,
      requestBound: true,
    },
    orderedPolicyChecks: evaluation.orderedChecks,
    decision: evaluation.decision,
    signerCalled: false,
    submitterCalled: false,
    premiumResourceReleased: true,
    mode: "hosted-judge-demo",
    boundaryNote:
      "This invocation moves no funds. Separate public evidence records one previously completed, independently verified Casper Testnet payment.",
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
    payeeAccountHash: evidence.payeeAccountHash,
    timestamp: evidence.transactionTimestamp,
    executionStatus: evidence.executionStatus,
    explorerUrl: evidence.explorerUrl,
    paymentResponseVerified: evidence.paymentResponseVerified,
    premiumResourceReleased: evidence.premiumResourceReleased,
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
      "Merchant, payee, resource, amount, budget, integrity, and expiry limits run before signing.",
      "Unknown execution state never becomes success.",
      "Transaction and receipt replay are rejected.",
      "Hosted mode has no signer, no private key, and cannot spend.",
    ],
  } as const;
}
