export interface AgentDemoConfig {
  /** Mock mode only for now. */
  mode: string;
  /** Paid API base URL. */
  paidApiBaseUrl: string;
  /** Agent identity. */
  agentId: string;
  /** Policy to use for authorization. */
  policyId: string;
  /** Target resource URL. */
  targetUrl: string;
  /** Start paid-api in-process. */
  autoStartPaidApi: boolean;
  /** Auto-settle after successful retrieval. */
  autoSettle: boolean;
  /** Port for in-process paid-api server. */
  demoPort: number;
}

export function loadAgentDemoConfig(
  env: NodeJS.ProcessEnv = process.env,
): AgentDemoConfig {
  return {
    mode: env.AGENTPAY_AGENT_MODE ?? "mock",
    paidApiBaseUrl:
      env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000",
    agentId: env.AGENTPAY_AGENT_ID ?? "agent_research_001",
    policyId: env.AGENTPAY_POLICY_ID ?? "policy_demo_agent_001",
    targetUrl:
      env.AGENTPAY_TARGET_URL ??
      "http://127.0.0.1:4000/premium/parking-report/MAD-001",
    autoStartPaidApi: env.AGENTPAY_AUTO_START_PAID_API !== "false",
    autoSettle: env.AGENTPAY_AUTO_SETTLE !== "false",
    demoPort: Number(env.AGENTPAY_DEMO_PORT ?? "4000"),
  };
}
