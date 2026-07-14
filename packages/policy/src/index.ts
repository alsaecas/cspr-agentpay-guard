import {
  normalizeUrl,
  type AgentPolicy,
  type GuardCheck,
  type GuardDecision,
  type GuardDecisionReason,
  type GuardedPaymentRequest,
  type Merchant,
  type PaymentReceipt,
  type PaymentRequirement,
  type PolicyDecision,
  type PolicyDenialReason,
} from "@cspr-agentpay/protocol";

export interface EvaluatePaymentPolicyInput {
  policy?: AgentPolicy | null | undefined;
  merchant?: Merchant | null | undefined;
  requirement: PaymentRequirement;
  currentPayments?: PaymentReceipt[] | undefined;
  expectedRequestHash?: string | undefined;
  now?: Date | undefined;
}

export interface EvaluateGuardedPaymentInput {
  policy?: AgentPolicy | null | undefined;
  merchant?: Merchant | null | undefined;
  request: GuardedPaymentRequest;
  expectedRequestHash: string;
  expectedBodyHash: string;
  expectedAmount?: string | undefined;
  usedNonces?: ReadonlySet<string> | undefined;
  policySignatureValid?: boolean | undefined;
  now?: Date | undefined;
}

export class PolicyDeniedError extends Error {
  readonly reason: PolicyDenialReason;

  constructor(reason: PolicyDenialReason, message: string = reason) {
    super(message);
    this.name = "PolicyDeniedError";
    this.reason = reason;
  }
}

const HEX_256 = /^[a-f0-9]{64}$/;

export function evaluatePaymentPolicy(
  input: EvaluatePaymentPolicyInput,
): PolicyDecision {
  const now = input.now ?? new Date();
  const checkedAt = now.toISOString();
  const policy = input.policy ?? null;
  const merchant = input.merchant ?? null;
  const requirement = input.requirement;

  if (!policy) {
    return deny("POLICY_NOT_FOUND", checkedAt, {
      merchantId: requirement.merchantId,
      message: "No policy was found for this authorization request.",
    });
  }

  const remainingBudget = calculateRemainingBudget(policy).toString();

  if (policy.status !== "active" || isExpired(policy.expiresAt, now)) {
    return deny("POLICY_INACTIVE", checkedAt, {
      policyId: policy.policyId,
      merchantId: requirement.merchantId,
      remainingBudget,
      message: "Policy is not active or has expired.",
    });
  }

  if (!merchant || merchant.merchantId !== requirement.merchantId) {
    return deny("MERCHANT_NOT_ALLOWED", checkedAt, {
      policyId: policy.policyId,
      merchantId: requirement.merchantId,
      remainingBudget,
      message: "Merchant is missing or not registered for this requirement.",
    });
  }

  if (merchant.status !== "active") {
    return deny("MERCHANT_INACTIVE", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Merchant is not active.",
    });
  }

  if (!policy.allowedMerchantIds.includes(merchant.merchantId)) {
    return deny("MERCHANT_NOT_ALLOWED", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Merchant is not on the policy allowlist.",
    });
  }

  if (requirement.merchantAccount !== merchant.settlementAccount) {
    return deny("MERCHANT_DESTINATION_MISMATCH", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Requirement destination does not match merchant registry.",
    });
  }

  const normalizedUrl = normalizeUrl(requirement.url);
  const policyResourceAllowed = matchResourcePattern(
    requirement.method,
    normalizedUrl,
    policy.allowedResourcePatterns,
  );
  const merchantResourceAllowed = matchResourcePattern(
    requirement.method,
    normalizedUrl,
    merchant.allowedResourcePatterns,
  );

  if (!policyResourceAllowed || !merchantResourceAllowed) {
    return deny("RESOURCE_NOT_ALLOWED", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Resource is outside policy or merchant scope.",
    });
  }

  if (requirement.currency !== policy.currency) {
    return deny("CURRENCY_MISMATCH", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Requirement currency does not match policy currency.",
    });
  }

  const amount = parseAmount(requirement.amount);
  if (amount === null || amount > parseAmount(policy.maxAmountPerPayment)!) {
    return deny("AMOUNT_EXCEEDS_PAYMENT_LIMIT", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Requirement amount exceeds per-payment policy limit.",
    });
  }

  if (
    parseAmount(policy.spentAmount)! + amount >
    parseAmount(policy.totalBudget)!
  ) {
    return deny("BUDGET_EXCEEDED", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Requirement amount exceeds remaining policy budget.",
    });
  }

  if (isExpired(requirement.expiresAt, now)) {
    return deny("REQUIREMENT_EXPIRED", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Payment requirement has expired.",
    });
  }

  if (
    !HEX_256.test(requirement.requestHash) ||
    (input.expectedRequestHash &&
      requirement.requestHash !== input.expectedRequestHash)
  ) {
    return deny("REQUEST_HASH_MISMATCH", checkedAt, {
      policyId: policy.policyId,
      merchantId: merchant.merchantId,
      remainingBudget,
      message: "Requirement request hash does not match the current request.",
    });
  }

  return {
    allowed: true,
    policyId: policy.policyId,
    merchantId: merchant.merchantId,
    remainingBudget,
    checkedAt,
  };
}

/** Deterministic authorization for normalized x402 requirements. */
export function evaluateGuardedPayment(
  input: EvaluateGuardedPaymentInput,
): GuardDecision {
  const now = input.now ?? new Date();
  const checkedAt = now.toISOString();
  const checks: GuardCheck[] = [];
  const { request } = input;
  const policy = input.policy ?? null;
  const merchant = input.merchant ?? null;

  const reject = (
    check: string,
    reason: GuardDecisionReason,
    message: string,
    budgetBefore?: string,
  ): GuardDecision => {
    checks.push({ check, passed: false, reason, message });
    return {
      allowed: false,
      decision: "DENY",
      reason,
      message,
      checkedAt,
      checks,
      policyId: policy?.policyId,
      merchantId: request.merchantId,
      budgetBefore,
      budgetAfter: budgetBefore,
    };
  };

  const pass = (check: string, message: string) => {
    checks.push({ check, passed: true, message });
  };

  if (
    !policy ||
    policy.status !== "active" ||
    isExpired(policy.expiresAt, now)
  ) {
    return reject(
      "policy_active",
      "POLICY_INACTIVE",
      "Policy is missing, inactive, or expired.",
    );
  }
  pass("policy_active", "Policy is active.");

  const budgetBefore = calculateRemainingBudget(policy).toString();
  if (input.policySignatureValid === false) {
    return reject(
      "policy_signature",
      "POLICY_SIGNATURE_INVALID",
      "Owner-signed policy permit is invalid.",
      budgetBefore,
    );
  }
  pass(
    "policy_signature",
    input.policySignatureValid === undefined
      ? "No owner-signed permit is required by this policy."
      : "Owner-signed policy permit is valid.",
  );

  if (!policy.allowedNetworks?.includes(request.network)) {
    return reject(
      "network",
      "NETWORK_NOT_ALLOWED",
      "Payment network is not allowlisted by policy.",
      budgetBefore,
    );
  }
  pass("network", `Network ${request.network} is allowed.`);

  const allowedAssets = policy.allowedAssets ?? [policy.currency];
  if (!allowedAssets.includes(request.asset)) {
    return reject(
      "asset",
      "ASSET_NOT_ALLOWED",
      "Payment asset is not allowlisted by policy.",
      budgetBefore,
    );
  }
  pass("asset", `Asset ${request.asset} is allowed.`);

  const allowedPayees =
    policy.allowedPayees ?? (merchant ? [merchant.settlementAccount] : []);
  if (!allowedPayees.includes(request.payee)) {
    return reject(
      "payee",
      "PAYEE_NOT_ALLOWED",
      "Payment payee is not the exact allowlisted destination.",
      budgetBefore,
    );
  }
  pass("payee", "Payee exactly matches the allowlisted destination.");

  if (
    !merchant ||
    merchant.status !== "active" ||
    merchant.merchantId !== request.merchantId ||
    !policy.allowedMerchantIds.includes(request.merchantId) ||
    merchant.settlementAccount !== request.payee
  ) {
    return reject(
      "merchant",
      "MERCHANT_NOT_ALLOWED",
      "Merchant identity, status, or registered destination is not allowed.",
      budgetBefore,
    );
  }
  pass("merchant", `Merchant ${request.merchantId} is active and allowlisted.`);

  if (
    !matchResourcePattern(
      request.method,
      request.url,
      policy.allowedResourcePatterns,
    ) ||
    !matchResourcePattern(
      request.method,
      request.url,
      merchant.allowedResourcePatterns,
    )
  ) {
    return reject(
      "resource",
      "RESOURCE_NOT_ALLOWED",
      "HTTP method or resource URL is outside policy scope.",
      budgetBefore,
    );
  }
  pass("resource", `${request.method} ${request.url} is allowed.`);

  const amount = parseAmount(request.amount);
  const maxAmount = parseAmount(policy.maxAmountPerPayment);
  if (
    input.expectedAmount !== undefined &&
    request.amount !== input.expectedAmount
  ) {
    return reject(
      "amount_integrity",
      "AMOUNT_MISMATCH",
      "Amount differs from the expected resource price.",
      budgetBefore,
    );
  }
  pass(
    "amount_integrity",
    input.expectedAmount === undefined
      ? "No fixed resource price was configured."
      : "Amount matches the expected resource price.",
  );
  if (amount === null || maxAmount === null || amount > maxAmount) {
    return reject(
      "amount",
      "AMOUNT_EXCEEDS_PAYMENT_LIMIT",
      "Amount exceeds the per-payment limit.",
      budgetBefore,
    );
  }
  pass("amount", `Amount ${request.amount} is within the per-payment limit.`);

  if (amount > BigInt(budgetBefore)) {
    return reject(
      "budget",
      "BUDGET_EXCEEDED",
      "Amount exceeds the remaining policy budget.",
      budgetBefore,
    );
  }
  const budgetAfter = (BigInt(budgetBefore) - amount).toString();
  pass("budget", `Budget changes from ${budgetBefore} to ${budgetAfter}.`);

  if (
    isExpired(request.expiresAt, now) ||
    new Date(request.issuedAt).getTime() > now.getTime() ||
    new Date(request.expiresAt).getTime() <=
      new Date(request.issuedAt).getTime()
  ) {
    return reject(
      "expiry",
      "REQUIREMENT_EXPIRED",
      "Requirement timestamps are expired or invalid.",
      budgetBefore,
    );
  }
  pass("expiry", `Requirement expires at ${request.expiresAt}.`);

  if (request.bodyHash !== input.expectedBodyHash) {
    return reject(
      "body_hash",
      "BODY_HASH_MISMATCH",
      "Requirement body hash does not match the outgoing request body.",
      budgetBefore,
    );
  }
  pass("body_hash", "Body hash matches the outgoing request.");

  if (request.requestHash !== input.expectedRequestHash) {
    return reject(
      "request_hash",
      "REQUEST_HASH_MISMATCH",
      "Requirement request hash does not match the outgoing request.",
      budgetBefore,
    );
  }
  pass(
    "request_hash",
    "Request hash matches method, URL, body, merchant, agent, nonce, and expiry.",
  );

  const nonceKey = `${request.merchantId}:${request.nonce}`;
  if (input.usedNonces?.has(nonceKey)) {
    return reject(
      "nonce",
      "NONCE_ALREADY_USED",
      "Requirement nonce was already used.",
      budgetBefore,
    );
  }
  pass("nonce", "Requirement nonce has not been used.");

  if (
    request.facilitator &&
    !policy.allowedFacilitators?.includes(request.facilitator)
  ) {
    return reject(
      "facilitator",
      "FACILITATOR_NOT_ALLOWED",
      "Facilitator is not allowlisted by policy.",
      budgetBefore,
    );
  }
  pass(
    "facilitator",
    request.facilitator
      ? `Facilitator ${request.facilitator} is allowed.`
      : "No facilitator was declared.",
  );

  return {
    allowed: true,
    decision: "ALLOW",
    policyId: policy.policyId,
    merchantId: request.merchantId,
    checkedAt,
    checks,
    budgetBefore,
    budgetAfter,
  };
}

export function assertPaymentAllowed(input: EvaluatePaymentPolicyInput): void {
  const decision = evaluatePaymentPolicy(input);
  if (!decision.allowed) {
    throw new PolicyDeniedError(decision.reason, decision.message);
  }
}

export function matchResourcePattern(
  method: string,
  normalizedUrl: string,
  patterns: string[],
): boolean {
  const target = `${method.toUpperCase()} ${normalizeUrl(normalizedUrl)}`;

  return patterns.some((pattern) => {
    const [patternMethod, ...urlParts] = pattern.trim().split(/\s+/);
    if (!patternMethod || urlParts.length === 0) {
      return false;
    }

    const methodMatches =
      patternMethod === "*" ||
      patternMethod.toUpperCase() === method.toUpperCase();
    if (!methodMatches) {
      return false;
    }

    const urlPattern = normalizeUrlPattern(urlParts.join(" "));
    return globToRegExp(`${patternMethod.toUpperCase()} ${urlPattern}`).test(
      target,
    );
  });
}

export function calculateRemainingBudget(policy: AgentPolicy): bigint {
  const totalBudget = parseAmount(policy.totalBudget);
  const spentAmount = parseAmount(policy.spentAmount);
  if (totalBudget === null || spentAmount === null) {
    return 0n;
  }
  return totalBudget > spentAmount ? totalBudget - spentAmount : 0n;
}

export function updateSpendStateAfterAuthorization(
  policy: AgentPolicy,
  amount: string,
): AgentPolicy {
  const parsedAmount = parseAmount(amount);
  const currentSpent = parseAmount(policy.spentAmount);
  if (parsedAmount === null || currentSpent === null) {
    throw new PolicyDeniedError(
      "AMOUNT_EXCEEDS_PAYMENT_LIMIT",
      "Amount must be a positive integer string.",
    );
  }

  return {
    ...policy,
    spentAmount: (currentSpent + parsedAmount).toString(),
  };
}

function deny(
  reason: PolicyDenialReason,
  checkedAt: string,
  fields: {
    policyId?: string | undefined;
    merchantId?: string | undefined;
    remainingBudget?: string | undefined;
    message: string;
  },
): PolicyDecision {
  return {
    allowed: false,
    reason,
    checkedAt,
    ...fields,
  };
}

function parseAmount(amount: string): bigint | null {
  if (!/^(0|[1-9]\d*)$/.test(amount)) {
    return null;
  }
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

function isExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

function normalizeUrlPattern(pattern: string): string {
  if (!pattern.includes("*")) {
    return normalizeUrl(pattern);
  }

  return pattern
    .replace(/^([a-z][a-z0-9+.-]*):\/\//i, (match) => match.toLowerCase())
    .replace(
      /^([a-z][a-z0-9+.-]*:\/\/)([^/:?#]+)(:\d+)?/i,
      (_match, protocol: string, host: string, port?: string) => {
        const normalizedPort =
          (protocol === "https://" && port === ":443") ||
          (protocol === "http://" && port === ":80")
            ? ""
            : (port ?? "");
        return `${protocol}${host.toLowerCase()}${normalizedPort}`;
      },
    );
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}
