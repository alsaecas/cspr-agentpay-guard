import { z } from "zod";

import {
  PROTOCOL_VERSION,
  type AgentPolicy,
  type Merchant,
  type PaymentAuthorization,
  type PaymentReceipt,
  type PaymentRequirement,
  type CreateRequestHashInput,
} from "./types";
import { createRequestHash } from "./hash";

const nonEmptyString = z.string().trim().min(1);
const hexHash = z.string().regex(/^[a-f0-9]{64}$/);
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
  "pending",
  "escrowed",
  "settled",
  "refunded",
  "expired",
  "failed",
]);

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
    casperDeployHash: nonEmptyString,
    casperEventId: nonEmptyString,
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
