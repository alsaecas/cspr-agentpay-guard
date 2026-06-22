import { z } from "zod";

import {
  PROTOCOL_VERSION,
  type AgentPolicy,
  type AuditEvent,
  type Merchant,
  type PaymentAuthorization,
  type PaymentReceipt,
  type PaymentRequirement,
  type CreateRequestHashInput,
} from "./types";
import { createRequestHash } from "./hash";

const nonEmptyString = z.string().trim().min(1);
const hexHash = z.string().regex(/^[a-f0-9]{64}$/);
const hexHash64Ic = z.string().regex(/^[a-fA-F0-9]{64}$/);
const isoTimestamp = z.string().datetime();
const nonNegativeAmountString = nonEmptyString.refine(
  (value) => {
    try {
      return /^(0|[1-9]\d*)$/.test(value) && BigInt(value) >= 0n;
    } catch {
      return false;
    }
  },
  { message: "Amount must be a non-negative integer string." },
);
const positiveAmountString = nonEmptyString.refine(
  (value) => {
    try {
      return /^(0|[1-9]\d*)$/.test(value) && BigInt(value) > 0n;
    } catch {
      return false;
    }
  },
  { message: "Amount must be a positive integer string." },
);

export interface ProtocolValidationOptions {
  now?: Date;
}

export const ChainModeSchema = z.enum(["mock", "casper-testnet"]);

export const PaymentStatusSchema = z.enum([
  "required",
  "authorized",
  "submitted",
  "escrowed",
  "fulfilled",
  "settled",
  "refunded",
  "expired",
  "failed",
  "settlement_failed",
]);

export const PolicyDenialReasonSchema = z.enum([
  "POLICY_NOT_FOUND",
  "POLICY_INACTIVE",
  "MERCHANT_NOT_ALLOWED",
  "MERCHANT_INACTIVE",
  "MERCHANT_DESTINATION_MISMATCH",
  "RESOURCE_NOT_ALLOWED",
  "CURRENCY_MISMATCH",
  "AMOUNT_EXCEEDS_PAYMENT_LIMIT",
  "BUDGET_EXCEEDED",
  "REQUIREMENT_EXPIRED",
  "REQUEST_HASH_MISMATCH",
]);

export const PolicyDecisionSchema = z.discriminatedUnion("allowed", [
  z
    .object({
      allowed: z.literal(true),
      reason: z.undefined().optional(),
      policyId: nonEmptyString,
      merchantId: nonEmptyString,
      remainingBudget: nonNegativeAmountString,
      checkedAt: isoTimestamp,
    })
    .strict(),
  z
    .object({
      allowed: z.literal(false),
      reason: PolicyDenialReasonSchema,
      policyId: nonEmptyString.optional(),
      merchantId: nonEmptyString.optional(),
      remainingBudget: nonNegativeAmountString.optional(),
      checkedAt: isoTimestamp,
      message: nonEmptyString,
    })
    .strict(),
]);

export const CasperProofSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("mock"),
      hash: z.string().startsWith("mock-"),
      eventId: z.string().startsWith("mock-"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("transaction-v1"),
      transactionHash: hexHash64Ic,
      eventId: nonEmptyString.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("legacy-deploy"),
      deployHash: hexHash64Ic,
      eventId: nonEmptyString.optional(),
    })
    .strict(),
]);

export const AuditEventSchema = z
  .object({
    eventId: nonEmptyString,
    type: z.enum([
      "policy_created",
      "policy_revoked",
      "merchant_registered",
      "payment_required",
      "payment_authorized",
      "payment_denied",
      "payment_submitted",
      "payment_escrowed",
      "payment_fulfilled",
      "payment_settled",
      "payment_expired",
      "payment_failed",
      "replay_rejected",
      "duplicate_settlement_rejected",
    ]),
    createdAt: isoTimestamp,
    policyId: nonEmptyString.optional(),
    merchantId: nonEmptyString.optional(),
    paymentId: hexHash.optional(),
    status: PaymentStatusSchema.optional(),
    reason: z
      .union([
        PolicyDenialReasonSchema,
        z.literal("REPLAY_DETECTED"),
        z.literal("DUPLICATE_SETTLEMENT"),
      ])
      .optional(),
    message: nonEmptyString,
    proof: CasperProofSchema.optional(),
    metadata: z
      .record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()]),
      )
      .optional(),
  })
  .strict();

export const AgentPolicySchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    policyId: nonEmptyString,
    ownerAccount: nonEmptyString,
    agentId: nonEmptyString,
    status: z.enum(["active", "paused", "expired", "revoked"]),
    currency: z.literal("CSPR"),
    maxAmountPerPayment: positiveAmountString,
    totalBudget: positiveAmountString,
    spentAmount: nonNegativeAmountString,
    budgetWindow: nonEmptyString,
    allowedMerchantIds: z.array(nonEmptyString).min(1),
    allowedResourcePatterns: z.array(nonEmptyString).min(1),
    expiresAt: isoTimestamp,
    policyNonce: nonEmptyString,
    createdAt: isoTimestamp,
  })
  .strict();

export const MerchantSchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    merchantId: nonEmptyString,
    displayName: nonEmptyString,
    status: z.enum(["active", "paused", "revoked"]),
    casperAccount: nonEmptyString,
    settlementAccount: nonEmptyString,
    allowedOrigins: z.array(z.string().url()).min(1),
    allowedResourcePatterns: z.array(nonEmptyString).min(1),
    createdAt: isoTimestamp,
  })
  .strict();

export const PaymentRequirementSchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    requirementId: nonEmptyString,
    merchantId: nonEmptyString,
    merchantAccount: nonEmptyString,
    method: nonEmptyString,
    url: z.string().url(),
    endpointId: nonEmptyString,
    amount: positiveAmountString,
    currency: z.literal("CSPR"),
    requestHash: hexHash,
    nonce: nonEmptyString,
    termsHash: hexHash,
    escrowMode: z.literal("authorize_then_settle"),
    expiresAt: isoTimestamp,
    issuedAt: isoTimestamp,
  })
  .strict();

export const PaymentAuthorizationSchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    paymentId: hexHash,
    policyId: nonEmptyString,
    agentId: nonEmptyString,
    merchantId: nonEmptyString,
    merchantAccount: nonEmptyString,
    requirementId: nonEmptyString,
    endpointId: nonEmptyString,
    requestHash: hexHash,
    amount: positiveAmountString,
    currency: z.literal("CSPR"),
    nonce: nonEmptyString,
    expiresAt: isoTimestamp,
    authorizedAt: isoTimestamp,
    signature: nonEmptyString,
  })
  .strict();

export const PaymentReceiptSchema = z
  .object({
    version: z.literal(PROTOCOL_VERSION),
    paymentId: hexHash,
    policyId: nonEmptyString,
    agentId: nonEmptyString,
    merchantId: nonEmptyString,
    merchantAccount: nonEmptyString,
    endpointId: nonEmptyString,
    requestHash: hexHash,
    amount: positiveAmountString,
    currency: z.literal("CSPR"),
    status: PaymentStatusSchema,
    chainMode: ChainModeSchema,
    proof: CasperProofSchema,
    casperDeployHash: nonEmptyString.optional(),
    casperEventId: nonEmptyString.optional(),
    receiptNonce: nonEmptyString,
    issuedAt: isoTimestamp,
    expiresAt: isoTimestamp,
    responseHash: hexHash.optional(),
  })
  .strict();

export function validateAgentPolicy(input: unknown): AgentPolicy {
  return AgentPolicySchema.parse(input);
}

export function validateMerchant(input: unknown): Merchant {
  return MerchantSchema.parse(input);
}

export function validatePaymentRequirement(
  input: unknown,
  options: ProtocolValidationOptions = {},
): PaymentRequirement {
  const requirement = PaymentRequirementSchema.parse(input);
  rejectExpired("REQUIREMENT_EXPIRED", requirement.expiresAt, options.now);
  return requirement;
}

export function validatePaymentAuthorization(
  input: unknown,
): PaymentAuthorization {
  return PaymentAuthorizationSchema.parse(input);
}

export function validatePaymentReceipt(input: unknown): PaymentReceipt {
  return PaymentReceiptSchema.parse(input);
}

export function validateAuditEvent(input: unknown): AuditEvent {
  return AuditEventSchema.parse(input);
}

export function validateReceiptForRequest(
  receiptInput: unknown,
  requestInput: CreateRequestHashInput,
): PaymentReceipt {
  const receipt = validatePaymentReceipt(receiptInput);
  const requestHash = createRequestHash(requestInput);

  if (receipt.requestHash !== requestHash) {
    throw new Error("REQUEST_HASH_MISMATCH");
  }

  return receipt;
}

function rejectExpired(errorCode: string, expiresAt: string, now = new Date()) {
  if (new Date(expiresAt).getTime() <= now.getTime()) {
    throw new Error(errorCode);
  }
}
