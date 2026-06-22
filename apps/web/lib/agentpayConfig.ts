export interface AgentPayDashboardConfig {
  mode: string;
  paidApiBaseUrl: string;
  defaultPolicyId: string;
  defaultAgentId: string;
  targetUrl: string;
  autoSettle: boolean;
}

export function loadDashboardConfig(): AgentPayDashboardConfig {
  return {
    mode: process.env.NEXT_PUBLIC_AGENTPAY_MODE ?? "mock",
    paidApiBaseUrl:
      process.env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000",
    defaultPolicyId:
      process.env.AGENTPAY_DEFAULT_POLICY_ID ?? "policy_demo_agent_001",
    defaultAgentId:
      process.env.AGENTPAY_DEFAULT_AGENT_ID ?? "agent_research_001",
    targetUrl:
      process.env.AGENTPAY_TARGET_URL ??
      "http://127.0.0.1:4000/premium/parking-report/MAD-001",
    autoSettle: process.env.AGENTPAY_AUTO_SETTLE !== "false",
  };
}
