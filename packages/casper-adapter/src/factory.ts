import { MockCasperPaymentAdapter } from "./mock";
import { RealCasperTestnetAdapter, loadRealCasperConfigFromEnv } from "./real";
import type { AgentPayMode, CasperPaymentAdapter } from "./types";

export function getAgentPayMode(
  env: NodeJS.ProcessEnv = process.env,
): AgentPayMode {
  const rawMode = env.AGENTPAY_MODE ?? "mock";
  if (rawMode === "casper-testnet") {
    return rawMode;
  }
  return "mock";
}

export function createCasperPaymentAdapter(options?: {
  mode?: AgentPayMode;
  env?: NodeJS.ProcessEnv;
}): CasperPaymentAdapter {
  const env = options?.env ?? process.env;
  const mode = options?.mode ?? getAgentPayMode(env);

  if (mode === "casper-testnet") {
    return new RealCasperTestnetAdapter(loadRealCasperConfigFromEnv(env));
  }

  return new MockCasperPaymentAdapter();
}
