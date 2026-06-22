export interface McpServerConfig {
  transport: "stdio" | "streamable-http";
  paidApiBaseUrl: string;
  defaultPolicyId: string;
  defaultAgentId: string;
  autoSetup: boolean;
  autoSettle: boolean;
}

export function loadMcpServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): McpServerConfig {
  return {
    transport: (env.AGENTPAY_MCP_TRANSPORT as "stdio" | "streamable-http") ?? "stdio",
    paidApiBaseUrl: env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000",
    defaultPolicyId: env.AGENTPAY_DEFAULT_POLICY_ID ?? "policy_demo_agent_001",
    defaultAgentId: env.AGENTPAY_DEFAULT_AGENT_ID ?? "agent_research_001",
    autoSetup: env.AGENTPAY_AUTO_SETUP !== "false",
    autoSettle: env.AGENTPAY_AUTO_SETTLE === "true",
  };
}
