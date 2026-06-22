import {
  PaymentReceiptSchema,
  PaymentRequirementSchema,
  type AuditEvent,
  type Merchant,
  type AgentPolicy,
  type PaymentReceipt,
  type PaymentRequirement,
  type PaymentAuthorization,
  type CasperProof,
} from "@cspr-agentpay/protocol";

import type { McpServerConfig } from "./config";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class PaidApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "PaidApiError";
  }
}

async function jsonFetch(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new PaidApiError(
      0,
      `Paid API unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  const rawBody = await res.text();

  let body: unknown;
  if (isJson && rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  } else {
    body = rawBody || null;
  }

  if (!res.ok) {
    throw new PaidApiError(res.status, `Paid API returned ${res.status}`, body);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface SetupDemoResult {
  merchant: Merchant;
  policy: AgentPolicy;
  auditEvents: AuditEvent[];
}

export interface AuthorizeResult {
  authorization: PaymentAuthorization;
  receipt: PaymentReceipt;
  proof: CasperProof;
  updatedPolicy: AgentPolicy;
  auditEvents: AuditEvent[];
}

export interface SettleResult {
  paymentId: string;
  status: string;
  payment: PaymentReceipt | null;
  auditEvents: AuditEvent[];
}

export interface PaidResourceResult {
  isPaid: boolean;
  resource?: unknown;
  paymentRequirement?: PaymentRequirement;
  authorization?: PaymentAuthorization;
  receipt?: PaymentReceipt;
  proof?: CasperProof;
  auditEvents?: AuditEvent[];
  settlement?: SettleResult;
}

export class PaidApiClient {
  private readonly baseUrl: string;

  constructor(config: McpServerConfig) {
    this.baseUrl = config.paidApiBaseUrl.replace(/\/$/, "");
  }

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  async health(): Promise<{ ok: boolean; mode: string }> {
    return jsonFetch(`${this.baseUrl}/health`) as Promise<{
      ok: boolean;
      mode: string;
    }>;
  }

  // -----------------------------------------------------------------------
  // Setup
  // -----------------------------------------------------------------------

  async setupDemo(): Promise<SetupDemoResult> {
    const body = (await jsonFetch(`${this.baseUrl}/demo/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })) as SetupDemoResult & { mode?: string };

    return {
      merchant: body.merchant,
      policy: body.policy,
      auditEvents: body.auditEvents,
    };
  }

  // -----------------------------------------------------------------------
  // Get paid resource
  // -----------------------------------------------------------------------

  async getPaidResource(
    url: string,
    receipt?: PaymentReceipt,
  ): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
    const init: RequestInit = { method: "GET" };

    if (receipt) {
      init.headers = {
        "X-AgentPay-Receipt": JSON.stringify(receipt),
      };
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      throw new PaidApiError(
        0,
        `Resource unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const rawBody = await res.text();
    let body: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json") && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    } else {
      body = rawBody || null;
    }

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { status: res.status, body, headers };
  }

  // -----------------------------------------------------------------------
  // Authorize requirement
  // -----------------------------------------------------------------------

  async authorizeRequirement(input: {
    policyId: string;
    agentId: string;
    requirement: PaymentRequirement;
  }): Promise<AuthorizeResult> {
    const body = (await jsonFetch(`${this.baseUrl}/demo/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyId: input.policyId,
        agentId: input.agentId,
        requirement: input.requirement,
      }),
    })) as AuthorizeResult & { receipt?: unknown; proof?: unknown };

    const receipt = PaymentReceiptSchema.parse(body.receipt);

    return {
      authorization: body.authorization,
      receipt,
      proof: body.proof as CasperProof,
      updatedPolicy: body.updatedPolicy,
      auditEvents: body.auditEvents as AuditEvent[],
    };
  }

  // -----------------------------------------------------------------------
  // Settle payment
  // -----------------------------------------------------------------------

  async settlePayment(paymentId: string): Promise<SettleResult> {
    const body = (await jsonFetch(`${this.baseUrl}/demo/settle/${paymentId}`, {
      method: "POST",
    })) as {
      settlement?: { status: string };
      payment?: PaymentReceipt | null;
      auditEvents?: AuditEvent[];
    };

    return {
      paymentId,
      status: body.settlement?.status ?? "unknown",
      payment: body.payment ?? null,
      auditEvents: (body.auditEvents as AuditEvent[]) ?? [],
    };
  }

  // -----------------------------------------------------------------------
  // Audit
  // -----------------------------------------------------------------------

  async getAuditEvents(paymentId?: string): Promise<AuditEvent[]> {
    const body = (await jsonFetch(`${this.baseUrl}/demo/audit`)) as {
      auditEvents?: AuditEvent[];
    };

    const events = (body.auditEvents as AuditEvent[]) ?? [];

    if (paymentId) {
      return events.filter((event) => event.paymentId === paymentId);
    }

    return events;
  }
}

export { PaidApiError };
