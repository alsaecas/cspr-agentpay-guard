export const PROTOCOL_VERSION = "agentpay-guard-v1" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type ChainMode = "mock" | "casper-testnet";
export type PaymentCurrency = "CSPR";
export type PolicyStatus = "active" | "paused" | "expired" | "revoked";
export type MerchantStatus = "active" | "paused" | "revoked";
export type PaymentStatus =
  | "pending"
  | "escrowed"
  | "settled"
  | "refunded"
  | "expired"
  | "failed";
export type ReceiptStatus = PaymentStatus;

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
  endpointId: string;
  amount: string;
  currency: PaymentCurrency;
  requestHash: string;
  nonce: string;
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
  merchantAccount: string;
  requirementId: string;
  endpointId: string;
  requestHash: string;
  amount: string;
  currency: PaymentCurrency;
  nonce: string;
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
  merchantAccount: string;
  endpointId: string;
  requestHash: string;
  amount: string;
  currency: PaymentCurrency;
  status: PaymentStatus;
  chainMode: ChainMode;
  casperDeployHash: string;
  casperEventId: string;
  receiptNonce: string;
  issuedAt: string;
  expiresAt: string;
  responseHash?: string | undefined;
}

export interface CreateRequestHashInput {
  method: string;
  url: string;
  bodyHash: string;
  endpointId: string;
  nonce: string;
  expiresAt: string;
}

export interface CreatePaymentIdInput {
  policyId: string;
  merchantAccount: string;
  amount: string;
  endpointId: string;
  requestHash: string;
  nonce: string;
}

export type RequestHashInput = CreateRequestHashInput;
export type PaymentIdInput = CreatePaymentIdInput;
