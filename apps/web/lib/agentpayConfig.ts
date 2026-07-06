export interface AgentPayDashboardConfig {
  mode: string;
  demoBackend: "self-contained" | "external";
  publicBaseUrl: string;
  paidApiBaseUrl: string;
  defaultPolicyId: string;
  defaultAgentId: string;
  targetUrl: string;
  autoSettle: boolean;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getDemoBackend(): AgentPayDashboardConfig["demoBackend"] {
  return process.env.AGENTPAY_DEMO_BACKEND === "external"
    ? "external"
    : "self-contained";
}

function getPublicBaseUrl(): string {
  const configured =
    process.env.AGENTPAY_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_AGENTPAY_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return stripTrailingSlash(configured);
  }

  if (process.env.VERCEL_URL) {
    return `https://${stripTrailingSlash(process.env.VERCEL_URL)}`;
  }

  return "http://localhost:3000";
}

export function loadDashboardConfig(): AgentPayDashboardConfig {
  const demoBackend = getDemoBackend();
  const publicBaseUrl = getPublicBaseUrl();
  const paidApiBaseUrl =
    process.env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000";

  return {
    mode: process.env.NEXT_PUBLIC_AGENTPAY_MODE ?? "mock",
    demoBackend,
    publicBaseUrl,
    paidApiBaseUrl,
    defaultPolicyId:
      process.env.AGENTPAY_DEFAULT_POLICY_ID ?? "policy_demo_agent_001",
    defaultAgentId:
      process.env.AGENTPAY_DEFAULT_AGENT_ID ?? "agent_research_001",
    targetUrl:
      process.env.AGENTPAY_TARGET_URL ??
      (demoBackend === "external"
        ? `${paidApiBaseUrl}/premium/parking-report/MAD-001`
        : `${publicBaseUrl}/premium/parking-report/MAD-001`),
    autoSettle: process.env.AGENTPAY_AUTO_SETTLE !== "false",
  };
}
