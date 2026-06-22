import { PaymentRequirementSchema, type AuditEvent } from "@cspr-agentpay/protocol";

import { PaidApiClient, PaidApiError, type PaidResourceResult } from "./client";
import type { McpServerConfig } from "./config";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface StatusResult {
  reachable: boolean;
  paidApiBaseUrl: string;
  tools: string[];
  config?: Record<string, unknown>;
}

export interface SetupDemoResult {
  merchantId: string;
  displayName: string;
  policyId: string;
  agentId: string;
  maxAmountPerPayment: string;
  totalBudget: string;
  status: string;
  expiresAt: string;
  auditEventCount: number;
}

export interface AuthorizeRequirementInput {
  requirement: Record<string, unknown>;
  policyId?: string | undefined;
  agentId?: string | undefined;
}

export interface CallPaidResourceInput {
  url: string;
  method?: string | undefined;
  policyId?: string | undefined;
  agentId?: string | undefined;
  autoSetup?: boolean | undefined;
  autoSettle?: boolean | undefined;
}

export interface CallPaidResourceResult {
  isPaid: boolean;
  resource?: unknown;
  paymentRequirement?: unknown;
  authorization?: unknown;
  receipt?: unknown;
  proof?: unknown;
  auditEvents?: unknown;
  timeline: string[];
  settlement?: { paymentId: string; status: string };
}

export interface AuditTimelineResult {
  auditEvents: AuditEvent[];
  timeline: string[];
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Tool handlers (reusable by MCP server and agent demo)
// ---------------------------------------------------------------------------

export async function getAgentPayStatusHandler(
  config: McpServerConfig,
  includeConfig = false,
): Promise<StatusResult> {
  const client = new PaidApiClient(config);

  let reachable = true;
  try {
    await client.health();
  } catch {
    reachable = false;
  }

  const tools = [
    "agentpay_status — server status + paid-api health",
    "setup_demo — initialize demo merchant and policy",
    "call_paid_resource — full 402 → authorize → retry → premium data",
    "authorize_requirement — authorize + escrow a payment requirement",
    "settle_payment — settle a fulfilled payment",
    "get_audit_timeline — retrieve ordered audit events",
  ];

  const result: StatusResult = {
    reachable,
    paidApiBaseUrl: config.paidApiBaseUrl,
    tools,
  };

  if (includeConfig) {
    result.config = {
      transport: config.transport,
      paidApiBaseUrl: config.paidApiBaseUrl,
      defaultPolicyId: config.defaultPolicyId,
      defaultAgentId: config.defaultAgentId,
      autoSetup: config.autoSetup,
      autoSettle: config.autoSettle,
    };
  }

  return result;
}

export async function setupDemoHandler(
  config: McpServerConfig,
): Promise<SetupDemoResult> {
  const client = new PaidApiClient(config);
  const demo = await client.setupDemo();

  return {
    merchantId: demo.merchant.merchantId,
    displayName: demo.merchant.displayName,
    policyId: demo.policy.policyId,
    agentId: demo.policy.agentId,
    maxAmountPerPayment: demo.policy.maxAmountPerPayment,
    totalBudget: demo.policy.totalBudget,
    status: demo.policy.status,
    expiresAt: demo.policy.expiresAt,
    auditEventCount: demo.auditEvents.length,
  };
}

export async function callPaidResourceHandler(
  input: CallPaidResourceInput,
  config: McpServerConfig,
): Promise<CallPaidResourceResult> {
  const client = new PaidApiClient(config);

  const effectivePolicyId = input.policyId ?? config.defaultPolicyId;
  const effectiveAgentId = input.agentId ?? config.defaultAgentId;
  const shouldSetup = input.autoSetup ?? config.autoSetup;
  const shouldSettle = input.autoSettle ?? config.autoSettle;

  const timeline: string[] = [];

  // 1. Auto-setup
  if (shouldSetup) {
    try {
      await client.setupDemo();
      timeline.push("Demo state initialized (auto-setup).");
    } catch {
      timeline.push("Auto-setup skipped (paid-api may already be initialized).");
    }
  }

  // 2. Call the resource without receipt
  timeline.push("Called protected resource.");
  const firstResponse = await client.getPaidResource(input.url);

  // 3. Not 402 → return directly
  if (firstResponse.status === 200) {
    return {
      isPaid: false,
      resource: firstResponse.body,
      timeline,
    };
  }

  if (firstResponse.status !== 402) {
    throw new PaidApiError(
      firstResponse.status,
      `Expected 402 Payment Required but got ${firstResponse.status}.`,
      firstResponse.body,
    );
  }

  // 4. Parse PaymentRequirement
  timeline.push("Received HTTP 402 PaymentRequirement.");
  const paymentBody = firstResponse.body as Record<string, unknown> | null;
  const requirementRaw = paymentBody?.paymentRequirement;
  if (!requirementRaw) {
    throw new Error("402 response did not contain a paymentRequirement field.");
  }

  const requirement = PaymentRequirementSchema.parse(requirementRaw);

  // 5. Authorize and submit
  timeline.push("Authorized payment under policy.");
  const authResult = await client.authorizeRequirement({
    policyId: effectivePolicyId,
    agentId: effectiveAgentId,
    requirement,
  });

  timeline.push("Submitted mock Casper payment into escrow.");

  // 6. Retry with receipt
  timeline.push("Retried protected resource with request-bound receipt.");
  const retryResponse = await client.getPaidResource(input.url, authResult.receipt);

  if (retryResponse.status !== 200) {
    throw new PaidApiError(
      retryResponse.status,
      `Retry with receipt failed (status ${retryResponse.status}).`,
      retryResponse.body,
    );
  }

  timeline.push("Received premium data.");
  timeline.push("Payment fulfilled.");

  const result: CallPaidResourceResult = {
    isPaid: true,
    resource: retryResponse.body,
    paymentRequirement: requirement,
    authorization: authResult.authorization,
    receipt: authResult.receipt,
    proof: authResult.proof,
    auditEvents: authResult.auditEvents,
    timeline,
  };

  // 7. Auto-settle
  if (shouldSettle && authResult.receipt.paymentId) {
    try {
      const settleResult = await client.settlePayment(authResult.receipt.paymentId);
      result.settlement = {
        paymentId: settleResult.paymentId,
        status: settleResult.status,
      };
      timeline.push("Payment settled.");
    } catch (settleErr) {
      timeline.push(
        `Settlement failed: ${settleErr instanceof Error ? settleErr.message : String(settleErr)}`,
      );
    }
  }

  return result;
}

export async function authorizeRequirementHandler(
  input: AuthorizeRequirementInput,
  config: McpServerConfig,
) {
  const client = new PaidApiClient(config);

  const parsed = PaymentRequirementSchema.parse(input.requirement);

  const result = await client.authorizeRequirement({
    policyId: input.policyId ?? config.defaultPolicyId,
    agentId: input.agentId ?? config.defaultAgentId,
    requirement: parsed,
  });

  return {
    authorization: result.authorization,
    receipt: result.receipt,
    proof: result.proof,
    updatedPolicy: result.updatedPolicy,
    auditEvents: result.auditEvents,
  };
}

export async function settlePaymentHandler(
  paymentId: string,
  config: McpServerConfig,
) {
  const client = new PaidApiClient(config);
  const result = await client.settlePayment(paymentId);

  return {
    paymentId: result.paymentId,
    status: result.status,
    auditEvents: result.auditEvents,
  };
}

export async function getAuditTimelineHandler(
  config: McpServerConfig,
  paymentId?: string,
): Promise<AuditTimelineResult> {
  const client = new PaidApiClient(config);
  const events = await client.getAuditEvents(paymentId);

  const timeline = events.map(
    (event) =>
      `[${event.createdAt}] ${event.type}${event.paymentId ? ` paymentId=${event.paymentId}` : ""} — ${event.message}`,
  );

  return {
    auditEvents: events,
    timeline,
    eventCount: events.length,
  };
}
