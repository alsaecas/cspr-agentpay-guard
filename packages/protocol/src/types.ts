export const PROTOCOL_VERSION = "agentpay-guard-v1" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type PaymentCurrency = "CSPR";
export type PolicyStatus = "active" | "paused" | "expired" | "revoked";
export type MerchantStatus = "active" | "paused" | "revoked";
export type ReceiptStatus =
  | "pending"
  | "escrowed"
  | "settled"
  | "refunded"
  | "expired"
  | "failed";

export interface AgentPolicy {
  version: ProtocolVersion;
  policyId: string;
  ownerAccount: string;
  agentId: string;
  status: PolicyStatus;
  currency: PaymentCurrency;
  maxAmountPerPayment: string;
  totalBudget: string;
  spentAmount: string;
  budgetWindow: string;
  allowedMerchantIds: string[];
  allowedResourcePatterns: string[];
  expiresAt: string;
  policyNonce: string;
  createdAt: string;
}

export interface Merchant {
  version: ProtocolVersion;
  merchantId: string;
  displayName: string;
  status: MerchantStatus;
  casperAccount: string;
  settlementAccount: string;
  allowedOrigins: string[];
  allowedResourcePatterns: string[];
  createdAt: string;
}

export interface PaymentRequirement {
  version: ProtocolVersion;
  requirementId: string;
  merchantId: string;
  merchantAccount: string;
  method: string;
  url: string;
  resourceId: string;
  amount: string;
  currency: PaymentCurrency;
  requestHash: string;
  requirementNonce: string;
  termsHash: string;
  escrowMode: "authorize_then_settle";
  expiresAt: string;
  issuedAt: string;
}

export interface PaymentAuthorization {
  version: ProtocolVersion;
  paymentId: string;
  policyId: string;
  agentId: string;
  merchantId: string;
  requirementId: string;
  requestHash: string;
  amount: string;
  currency: PaymentCurrency;
  authorizationNonce: string;
  expiresAt: string;
  authorizedAt: string;
  signature: string;
}

export interface PaymentReceipt {
  version: ProtocolVersion;
  paymentId: string;
  policyId: string;
  agentId: string;
  merchantId: string;
  requestHash: string;
  amount: string;
  currency: PaymentCurrency;
  status: ReceiptStatus;
  casperDeployHash: string;
  casperEventId: string;
  receiptNonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface RequestHashInput {
  method: string;
  url: string;
  resourceId: string;
  merchantId: string;
  agentId: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

export interface PaymentIdInput {
  policyId: string;
  agentId: string;
  merchantId: string;
  requirementId: string;
  requestHash: string;
  amount: string;
  currency: PaymentCurrency;
  requirementNonce: string;
  authorizationNonce: string;
}
