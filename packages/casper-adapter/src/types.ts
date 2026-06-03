import type {
  ChainMode,
  PaymentAuthorization,
  PaymentReceipt,
  PaymentRequirement,
  PaymentStatus,
} from "@cspr-agentpay/protocol";

export type AgentPayMode = ChainMode;

export interface SubmitPaymentInput {
  requirement: PaymentRequirement;
  authorization: PaymentAuthorization;
  now?: Date;
}

export interface SettlePaymentInput {
  paymentId: string;
  now?: Date;
}

export interface SettlementResult {
  paymentId: string;
  status: Extract<PaymentStatus, "settled">;
  casperDeployHash: string;
  casperEventId: string;
  settledAt: string;
}

export interface CasperPaymentAdapter {
  readonly mode: AgentPayMode;
  submitPayment(input: SubmitPaymentInput): Promise<PaymentReceipt>;
  settlePayment(input: SettlePaymentInput): Promise<SettlementResult>;
}

export interface RealCasperAdapterConfig {
  network: string;
  rpcUrl: string;
  secretKeyPath?: string;
  publicKey?: string;
}
