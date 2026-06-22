const BASE_URL = process.env.AGENTPAY_PAID_API_BASE_URL ?? "http://127.0.0.1:4000";

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

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new PaidApiError(
      0,
      `Paid API unreachable at ${url}. Start it with: pnpm --filter @cspr-agentpay/paid-api dev`,
    );
  }

  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = raw || null;
  }

  if (!res.ok) {
    throw new PaidApiError(res.status, `Paid API returned ${res.status}`, body);
  }

  return body;
}

export async function healthCheck() {
  const body = (await apiFetch("/health")) as { ok?: boolean; mode?: string };
  return { reachable: true, mode: body?.mode ?? "unknown" };
}

export async function setupDemo() {
  return apiFetch("/demo/setup", { method: "POST" });
}

export async function getPaidResource(url: string) {
  return apiFetch(url.replace(BASE_URL, ""));
}

export async function authorizePayment(input: {
  policyId: string;
  agentId: string;
  requirement: unknown;
}) {
  return apiFetch("/demo/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function settlePayment(paymentId: string) {
  return apiFetch(`/demo/settle/${paymentId}`, { method: "POST" });
}

export async function getAuditEvents() {
  return apiFetch("/demo/audit");
}

export async function runDemo(demoFlow: () => Promise<unknown>) {
  return demoFlow();
}

export { BASE_URL, PaidApiError };
