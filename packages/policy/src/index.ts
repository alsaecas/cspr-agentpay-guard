import {
  normalizeUrl,
  type AgentPolicy,
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
