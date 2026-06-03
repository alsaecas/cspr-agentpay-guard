import type {
  AgentPolicy,
  AuditEvent,
  CasperProof,
  ChainMode,
  CreateRequestHashInput,
  Merchant,
  PaymentAuthorization,
  PaymentReceipt,
  PaymentRequirement,
  PaymentStatus,
  PolicyDecision,
} from "@cspr-agentpay/protocol";

export type AgentPayMode = ChainMode;

export interface TxResult {
  status: "ok";
  proof: CasperProof;
  createdAt: string;
  policyId?: string | undefined;
  merchantId?: string | undefined;
  paymentId?: string | undefined;
}

export type CreatePolicyInput = AgentPolicy;
export type RegisterMerchantInput = Merchant;

export interface AuthorizePaymentInput {
  policyId: string;
  requirement: PaymentRequirement;
  request?: CreateRequestHashInput | undefined;
  expectedRequestHash?: string | undefined;
  authorizationNonce?: string | undefined;
  receiptNonce?: string | undefined;
  now?: Date | undefined;
}

export interface PaymentAuthorizationResult {
  authorization: PaymentAuthorization;
  decision: Extract<PolicyDecision, { allowed: true }>;
  receipt: PaymentReceipt;
  proof: CasperProof;
  updatedPolicy: AgentPolicy;
}

export interface SubmitPaymentInput {
  paymentId: string;
  now?: Date | undefined;
}

export interface MarkFulfilledInput {
  paymentId: string;
  responseBody?: unknown;
  responseHash?: string | undefined;
  now?: Date | undefined;
}

export interface SettlePaymentInput {
  paymentId: string;
  now?: Date | undefined;
}

export interface SettlementResult {
  paymentId: string;
  status: Extract<PaymentStatus, "settled">;
  proof: CasperProof;
  casperDeployHash?: string | undefined;
  casperEventId?: string | undefined;
  settledAt: string;
}

export interface ListPaymentsFilter {
  policyId?: string | undefined;
  merchantId?: string | undefined;
  status?: PaymentStatus | undefined;
}

export interface ListAuditEventsFilter {
  policyId?: string | undefined;
  merchantId?: string | undefined;
  paymentId?: string | undefined;
}

export interface CasperPaymentAdapter {
  readonly mode: AgentPayMode;
  createPolicy(input: CreatePolicyInput): Promise<AgentPolicy>;
  revokePolicy(policyId: string): Promise<TxResult>;
  registerMerchant(input: RegisterMerchantInput): Promise<Merchant>;
  authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<PaymentAuthorizationResult>;
  submitPayment(input: SubmitPaymentInput): Promise<PaymentReceipt>;
  markFulfilled(input: MarkFulfilledInput): Promise<PaymentReceipt>;
  settlePayment(input: SettlePaymentInput): Promise<SettlementResult>;
  expirePayment(paymentId: string): Promise<TxResult>;
  getPolicy(policyId: string): Promise<AgentPolicy | null>;
  getMerchant(merchantId: string): Promise<Merchant | null>;
  getPayment(paymentId: string): Promise<PaymentReceipt | null>;
  listPayments(filter?: ListPaymentsFilter): Promise<PaymentReceipt[]>;
  listAuditEvents(filter?: ListAuditEventsFilter): Promise<AuditEvent[]>;
}

export interface RealCasperAdapterConfig {
  network: string;
  rpcUrl: string;
  secretKeyPath?: string;
  publicKey?: string;
}
