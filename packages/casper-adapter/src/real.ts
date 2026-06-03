import type {
  AgentPolicy,
  AuditEvent,
  Merchant,
  PaymentReceipt,
} from "@cspr-agentpay/protocol";

import type {
  AuthorizePaymentInput,
  CasperPaymentAdapter,
  ListAuditEventsFilter,
  ListPaymentsFilter,
  MarkFulfilledInput,
  PaymentAuthorizationResult,
  RealCasperAdapterConfig,
  RegisterMerchantInput,
  SettlePaymentInput,
  SettlementResult,
  SubmitPaymentInput,
  TxResult,
} from "./types";

export class RealCasperTestnetAdapter implements CasperPaymentAdapter {
  readonly mode = "casper-testnet" as const;

  constructor(private readonly config: RealCasperAdapterConfig) {}

  async createPolicy(_input: AgentPolicy): Promise<AgentPolicy> {
    return this.notImplemented();
  }

  async revokePolicy(_policyId: string): Promise<TxResult> {
    return this.notImplemented();
  }

  async registerMerchant(_input: RegisterMerchantInput): Promise<Merchant> {
    return this.notImplemented();
  }

  async authorizePayment(
    _input: AuthorizePaymentInput,
  ): Promise<PaymentAuthorizationResult> {
    return this.notImplemented();
  }

  async submitPayment(_input: SubmitPaymentInput): Promise<PaymentReceipt> {
    return this.notImplemented();
  }

  async markFulfilled(_input: MarkFulfilledInput): Promise<PaymentReceipt> {
    return this.notImplemented();
  }

  async settlePayment(_input: SettlePaymentInput): Promise<SettlementResult> {
    return this.notImplemented();
  }

  async expirePayment(_paymentId: string): Promise<TxResult> {
    return this.notImplemented();
  }

  async getPolicy(_policyId: string): Promise<AgentPolicy | null> {
    return this.notImplemented();
  }

  async getMerchant(_merchantId: string): Promise<Merchant | null> {
    return this.notImplemented();
  }

  async getPayment(_paymentId: string): Promise<PaymentReceipt | null> {
    return this.notImplemented();
  }

  async listPayments(
    _filter: ListPaymentsFilter = {},
  ): Promise<PaymentReceipt[]> {
    return this.notImplemented();
  }

  async listAuditEvents(
    _filter: ListAuditEventsFilter = {},
  ): Promise<AuditEvent[]> {
    return this.notImplemented();
  }

  private notImplemented<T>(): T {
    throw new Error(
      `Real Casper adapter is scaffolded but not implemented. Wire casper-js-sdk against ${this.config.rpcUrl} after the local state machine and 402 flow are complete.`,
    );
  }
}

export function loadRealCasperConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RealCasperAdapterConfig {
  const config: RealCasperAdapterConfig = {
    network: env.CASPER_NETWORK ?? "casper-test",
    rpcUrl: env.CASPER_RPC_URL ?? "https://node.testnet.cspr.cloud/rpc",
  };

  if (env.CASPER_TESTNET_SECRET_KEY_PATH) {
    config.secretKeyPath = env.CASPER_TESTNET_SECRET_KEY_PATH;
  }
  if (env.CASPER_TESTNET_PUBLIC_KEY) {
    config.publicKey = env.CASPER_TESTNET_PUBLIC_KEY;
  }

  return config;
}
