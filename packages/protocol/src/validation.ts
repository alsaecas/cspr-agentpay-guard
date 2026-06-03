import { z } from "zod";

import { PROTOCOL_VERSION } from "./types";

const amountString = z.string().regex(/^\d+$/);
const hexHash = z.string().regex(/^[a-f0-9]{64}$/);
const isoTimestamp = z.string().datetime();

export const AgentPolicySchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  policyId: z.string().min(1),
  ownerAccount: z.string().min(1),
  agentId: z.string().min(1),
  status: z.enum(["active", "paused", "expired", "revoked"]),
  currency: z.literal("CSPR"),
  maxAmountPerPayment: amountString,
  totalBudget: amountString,
  spentAmount: amountString,
  budgetWindow: z.string().min(1),
  allowedMerchantIds: z.array(z.string().min(1)),
  allowedResourcePatterns: z.array(z.string().min(1)),
  expiresAt: isoTimestamp,
  policyNonce: z.string().min(1),
  createdAt: isoTimestamp,
});

export const MerchantSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  merchantId: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(["active", "paused", "revoked"]),
  casperAccount: z.string().min(1),
  settlementAccount: z.string().min(1),
  allowedOrigins: z.array(z.string().url()),
  allowedResourcePatterns: z.array(z.string().min(1)),
  createdAt: isoTimestamp,
});

export const PaymentRequirementSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  requirementId: z.string().min(1),
  merchantId: z.string().min(1),
  merchantAccount: z.string().min(1),
  method: z.string().min(1),
  url: z.string().url(),
  resourceId: z.string().min(1),
  amount: amountString,
  currency: z.literal("CSPR"),
  requestHash: hexHash,
  requirementNonce: z.string().min(1),
  termsHash: hexHash,
  escrowMode: z.literal("authorize_then_settle"),
  expiresAt: isoTimestamp,
  issuedAt: isoTimestamp,
});

export const PaymentAuthorizationSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  paymentId: hexHash,
  policyId: z.string().min(1),
  agentId: z.string().min(1),
  merchantId: z.string().min(1),
  requirementId: z.string().min(1),
  requestHash: hexHash,
  amount: amountString,
  currency: z.literal("CSPR"),
  authorizationNonce: z.string().min(1),
  expiresAt: isoTimestamp,
  authorizedAt: isoTimestamp,
  signature: z.string().min(1),
});

export const PaymentReceiptSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  paymentId: hexHash,
  policyId: z.string().min(1),
  agentId: z.string().min(1),
  merchantId: z.string().min(1),
  requestHash: hexHash,
  amount: amountString,
  currency: z.literal("CSPR"),
  status: z.enum([
    "pending",
    "escrowed",
    "settled",
    "refunded",
    "expired",
    "failed",
  ]),
  casperDeployHash: z.string().min(1),
  casperEventId: z.string().min(1),
  receiptNonce: z.string().min(1),
  issuedAt: isoTimestamp,
  expiresAt: isoTimestamp,
});
