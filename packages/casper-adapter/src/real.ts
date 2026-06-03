import type {
  CasperPaymentAdapter,
  RealCasperAdapterConfig,
  SettlePaymentInput,
  SettlementResult,
  SubmitPaymentInput,
} from "./types";

export class RealCasperTestnetAdapter implements CasperPaymentAdapter {
  readonly mode = "casper-testnet" as const;

  constructor(private readonly config: RealCasperAdapterConfig) {}

  async submitPayment(_input: SubmitPaymentInput): Promise<never> {
    throw new Error(
      `Real Casper adapter is scaffolded but not implemented. Configure the mock flow first, then wire casper-js-sdk against ${this.config.rpcUrl}.`,
    );
  }

  async settlePayment(_input: SettlePaymentInput): Promise<SettlementResult> {
    throw new Error(
      "Real Casper settlement is scaffolded but not implemented. Use AGENTPAY_MODE=mock until Testnet wiring lands.",
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
