export const PROTOCOL_VERSION = "agentpay-guard-v1" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type ChainMode = "mock" | "casper-testnet";
export type PaymentCurrency = "CSPR";
export type PaymentNetwork = string;
export type PaymentAsset = string;
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

export type GuardDecisionReason =
  | "MALFORMED_REQUIREMENT"
  | "NETWORK_NOT_ALLOWED"
  | "ASSET_NOT_ALLOWED"
  | "PAYEE_MISMATCH"
  | "PAYEE_NOT_ALLOWED"
  | "MERCHANT_NOT_ALLOWED"
  | "RESOURCE_NOT_ALLOWED"
  | "AMOUNT_EXCEEDS_PAYMENT_LIMIT"
  | "AMOUNT_MISMATCH"
  | "BUDGET_EXCEEDED"
  | "REQUIREMENT_EXPIRED"
  | "REQUEST_HASH_MISMATCH"
  | "BODY_HASH_MISMATCH"
  | "NONCE_ALREADY_USED"
  | "FACILITATOR_NOT_ALLOWED"
  | "POLICY_SIGNATURE_INVALID"
  | "POLICY_INACTIVE";

export interface GuardedPaymentRequest {
  version: ProtocolVersion;
  x402Version: 2;
  scheme: string;
  method: string;
  url: string;
  endpointId: string;
  bodyHash: string;
  requestHash: string;
  merchantId: string;
  providerId: string;
  payee: string;
  network: PaymentNetwork;
  asset: PaymentAsset;
  amount: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  facilitator?: string | undefined;
  originalPaymentRequired: Record<string, unknown>;
  selectedRequirement: Record<string, unknown>;
}

export const CASPER_PAYMENT_AUTHORIZATION_VERSION =
  "agentpay-casper-payment-v1" as const;

/** Immutable, canonically hashed intent signed before a Casper native transfer. */
export interface CasperPaymentAuthorization {
  version: typeof CASPER_PAYMENT_AUTHORIZATION_VERSION;
  paymentId: string;
  policyId: string;
  agentId: string;
  requestHash: string;
  bodyHash: string;
  merchantId: string;
  destination: string;
  network: "casper-test";
  asset: "CSPR";
  amountMotes: string;
  nonce: string;
  transferId: string;
  issuedAt: string;
  expiresAt: string;
  facilitator: string;
  requirementHash: string;
}

export interface GuardCheck {
  check: string;
  passed: boolean;
  reason?: GuardDecisionReason | undefined;
  message: string;
}

export type GuardDecision =
  | {
      allowed: true;
      decision: "ALLOW";
      policyId: string;
      merchantId: string;
      reason?: undefined;
      checkedAt: string;
      checks: GuardCheck[];
      budgetBefore: string;
      budgetAfter: string;
    }
  | {
      allowed: false;
      decision: "DENY";
      policyId?: string | undefined;
      merchantId?: string | undefined;
      reason: GuardDecisionReason;
      message: string;
      checkedAt: string;
      checks: GuardCheck[];
      budgetBefore?: string | undefined;
      budgetAfter?: string | undefined;
    };

export type PaymentSettlementEvidence =
  | {
      mode: "mock";
      status: "settled";
      settlementId: string;
      transactionHash?: undefined;
      network: PaymentNetwork;
    }
  | {
      mode: "casper-testnet";
      status: "settled";
      transactionHash: string;
      network: PaymentNetwork;
      explorerUrl?: string | undefined;
    }
  | {
      mode: "casper-testnet";
      status: "unsupported" | "failed";
      transactionHash?: undefined;
      network: PaymentNetwork;
      message: string;
    };

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
  allowedNetworks?: PaymentNetwork[] | undefined;
  allowedAssets?: PaymentAsset[] | undefined;
  allowedPayees?: string[] | undefined;
  allowedFacilitators?: string[] | undefined;
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
