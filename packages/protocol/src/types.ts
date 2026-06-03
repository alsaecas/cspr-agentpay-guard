export const PROTOCOL_VERSION = "agentpay-guard-v1" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type ChainMode = "mock" | "casper-testnet";
export type PaymentCurrency = "CSPR";
export type PolicyStatus = "active" | "paused" | "expired" | "revoked";
export type MerchantStatus = "active" | "paused" | "revoked";
export type PaymentStatus =
  | "required"
  | "authorized"
  | "submitted"
  | "escrowed"
  | "fulfilled"
  | "settled"
  | "refunded"
  | "expired"
  | "failed"
  | "settlement_failed";
export type ReceiptStatus = PaymentStatus;

export type PolicyDenialReason =
  | "POLICY_NOT_FOUND"
  | "POLICY_INACTIVE"
  | "MERCHANT_NOT_ALLOWED"
  | "MERCHANT_INACTIVE"
  | "MERCHANT_DESTINATION_MISMATCH"
  | "RESOURCE_NOT_ALLOWED"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_EXCEEDS_PAYMENT_LIMIT"
  | "BUDGET_EXCEEDED"
  | "REQUIREMENT_EXPIRED"
  | "REQUEST_HASH_MISMATCH";

export type CasperProof =
  | { kind: "mock"; hash: string; eventId: string }
  | {
      kind: "transaction-v1";
      transactionHash: string;
      eventId?: string | undefined;
    }
  | { kind: "legacy-deploy"; deployHash: string; eventId?: string | undefined };

export type AuditEventType =
  | "policy_created"
  | "policy_revoked"
  | "merchant_registered"
  | "payment_required"
  | "payment_authorized"
  | "payment_denied"
  | "payment_submitted"
  | "payment_escrowed"
  | "payment_fulfilled"
  | "payment_settled"
  | "payment_expired"
  | "payment_failed"
  | "replay_rejected"
  | "duplicate_settlement_rejected";

export interface AuditEvent {
  eventId: string;
  type: AuditEventType;
  createdAt: string;
  policyId?: string | undefined;
  merchantId?: string | undefined;
  paymentId?: string | undefined;
  status?: PaymentStatus | undefined;
  reason?:
    | PolicyDenialReason
    | "REPLAY_DETECTED"
    | "DUPLICATE_SETTLEMENT"
    | undefined;
  message: string;
  proof?: CasperProof | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

export type PolicyDecision =
  | {
      allowed: true;
      reason?: undefined;
      policyId: string;
      merchantId: string;
      remainingBudget: string;
      checkedAt: string;
    }
  | {
      allowed: false;
      reason: PolicyDenialReason;
      policyId?: string | undefined;
      merchantId?: string | undefined;
      remainingBudget?: string | undefined;
      checkedAt: string;
      message: string;
    };

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
  proof: CasperProof;
  casperDeployHash?: string | undefined;
  casperEventId?: string | undefined;
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
  merchantId: string;
  agentId: string;
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
