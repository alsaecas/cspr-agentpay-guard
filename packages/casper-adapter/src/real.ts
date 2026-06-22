import type {
  AgentPolicy,
  AuditEvent,
  Merchant,
  PaymentReceipt,
} from "@cspr-agentpay/protocol";

import type {
  AuthorizePaymentInput,
  CasperPaymentAdapter,
  CreatePolicyInput,
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

const NOT_IMPLEMENTED_MESSAGE =
  "is not implemented yet. Use mock mode or complete contract deployment." as const;

export class RealCasperTestnetAdapter implements CasperPaymentAdapter {
  readonly mode = "casper-testnet" as const;

  constructor(private readonly config: RealCasperAdapterConfig) {}

  // ---------------------------------------------------------------------------
  // CasperPaymentAdapter interface
  // ---------------------------------------------------------------------------

  async createPolicy(_input: CreatePolicyInput): Promise<AgentPolicy> {
    throw new Error(`Casper Testnet createPolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async revokePolicy(_policyId: string): Promise<TxResult> {
    throw new Error(`Casper Testnet revokePolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async registerMerchant(_input: RegisterMerchantInput): Promise<Merchant> {
    throw new Error(
      `Casper Testnet registerMerchant ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  async authorizePayment(
    _input: AuthorizePaymentInput,
  ): Promise<PaymentAuthorizationResult> {
    throw new Error(
      `Casper Testnet authorizePayment ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  async submitPayment(_input: SubmitPaymentInput): Promise<PaymentReceipt> {
    throw new Error(`Casper Testnet submitPayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async markFulfilled(_input: MarkFulfilledInput): Promise<PaymentReceipt> {
    throw new Error(`Casper Testnet markFulfilled ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async settlePayment(_input: SettlePaymentInput): Promise<SettlementResult> {
    throw new Error(`Casper Testnet settlePayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async expirePayment(_paymentId: string): Promise<TxResult> {
    throw new Error(`Casper Testnet expirePayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getPolicy(_policyId: string): Promise<AgentPolicy | null> {
    throw new Error(`Casper Testnet getPolicy ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getMerchant(_merchantId: string): Promise<Merchant | null> {
    throw new Error(`Casper Testnet getMerchant ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async getPayment(_paymentId: string): Promise<PaymentReceipt | null> {
    throw new Error(`Casper Testnet getPayment ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async listPayments(
    _filter: ListPaymentsFilter = {},
  ): Promise<PaymentReceipt[]> {
    throw new Error(`Casper Testnet listPayments ${NOT_IMPLEMENTED_MESSAGE}`);
  }

  async listAuditEvents(
    _filter: ListAuditEventsFilter = {},
  ): Promise<AuditEvent[]> {
    throw new Error(
      `Casper Testnet listAuditEvents ${NOT_IMPLEMENTED_MESSAGE}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Prompt 10: Testnet proof support (not production escrow)
  // ---------------------------------------------------------------------------

  /**
   * Build a dry-run CasperProof payload WITHOUT submitting to the chain.
   * Always safe — no credentials needed.
   *
   * Returns a CasperProof that WOULD be submitted if env is configured.
   * The proof.kind is "transaction-v1" when a contract hash is available,
   * otherwise falls back to a documented placeholder.
   */
  static buildProofDryRun(input: {
    paymentId: string;
    requestHash: string;
    policyId: string;
    merchantId: string;
    status: string;
    receiptHash?: string;
    env?: NodeJS.ProcessEnv;
  }): {
    proof: { kind: "transaction-v1" | "legacy-deploy"; transactionHash?: string | undefined; deployHash?: string | undefined };
    payload: Record<string, string>;
    missingEnvVars: string[];
  } {
    const env = input.env ?? process.env;
    const missing = RealCasperTestnetAdapter.getMissingEnvVars(env);

    const payload: Record<string, string> = {
      paymentId: input.paymentId,
      requestHash: input.requestHash,
      policyId: input.policyId,
      merchantId: input.merchantId,
      status: input.status,
    };
    if (input.receiptHash) {
      payload.receiptHash = input.receiptHash;
    }

    const contractHash = env.CASPER_AGENTPAY_CONTRACT_HASH;
    const placeholderHash = "0".repeat(64);

    const proof = {
      kind: "transaction-v1" as const,
      transactionHash: contractHash ? placeholderHash : undefined,
    };

    return { proof, payload, missingEnvVars: missing };
  }

  /**
   * Record an AgentPay proof on Casper Testnet.
   *
   * THIS IS A SKELETON — it does NOT submit real transactions yet.
   * It validates env vars and returns a dry-run proof.
   * When real contract deployment is complete, this method will submit
   * a TransactionV1 to the Casper Testnet RPC and return the tx hash.
   */
  static async recordAgentPayProof(input: {
    paymentId: string;
    requestHash: string;
    policyId: string;
    merchantId: string;
    status: string;
    receiptHash?: string;
    env?: NodeJS.ProcessEnv;
  }): Promise<{
    proof: { kind: "transaction-v1" | "legacy-deploy"; transactionHash?: string | undefined };
    submitted: boolean;
    message: string;
  }> {
    const env = input.env ?? process.env;
    const missing = RealCasperTestnetAdapter.getMissingEnvVars(env);

    if (missing.length > 0) {
      return {
        proof: {
          kind: "transaction-v1",
          transactionHash: undefined,
        },
        submitted: false,
        message:
          `Cannot submit to Casper Testnet. Missing env vars: ${missing.join(", ")}. ` +
          `Set them in .env or run with pnpm proof:testnet:dry-run to validate payload.`,
      };
    }

    // Placeholder: real deploy submission would go here using casper-js-sdk.
    // For now, return a dry-run proof with clear messaging.
    const dryRun = RealCasperTestnetAdapter.buildProofDryRun(input);

    return {
      proof: dryRun.proof,
      submitted: false,
      message:
        "recordAgentPayProof is a skeleton. Real Casper Testnet transaction submission is pending Odra contract deployment. " +
        "Use pnpm proof:testnet:dry-run to validate payloads. " +
        `Payload: ${JSON.stringify(dryRun.payload)}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Environment validation
  // ---------------------------------------------------------------------------

  /**
   * Returns the names of required environment variables that are missing
   * or empty. Does not throw. Useful for early diagnostics before
   * attempting any real Casper Testnet operation.
   */
  static getMissingEnvVars(
    env: NodeJS.ProcessEnv = process.env,
  ): string[] {
    const required: string[] = [
      "CASPER_TESTNET_PUBLIC_KEY",
      "CASPER_TESTNET_SECRET_KEY_PATH",
      "CASPER_RPC_URL",
      "CSPR_CLOUD_AUTH_TOKEN",
      "CASPER_AGENTPAY_CONTRACT_HASH",
    ];

    return required.filter((name) => !env[name]);
  }

  /**
   * Validates that all required environment variables for real Casper
   * Testnet operations are set. Throws with a detailed message listing
   * all missing variables if any are absent.
   */
  static assertEnvReady(env: NodeJS.ProcessEnv = process.env): void {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars(env);
    if (missing.length > 0) {
      throw new Error(
        `Casper Testnet environment is not ready. ` +
          `Missing variables: ${missing.join(", ")}. ` +
          `Set them in your .env file or use mock mode (AGENTPAY_MODE=mock).`,
      );
    }
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
