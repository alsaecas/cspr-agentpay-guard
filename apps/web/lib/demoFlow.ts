import { loadDashboardConfig } from "./agentpayConfig";
import * as api from "./paidApiClient";

export interface DemoStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export interface DemoRunResult {
  success: boolean;
  error?: string;
  mode: string;
  steps: DemoStep[];
  policy?: Record<string, unknown>;
  merchant?: Record<string, unknown>;
  paymentRequirement?: Record<string, unknown>;
  authorization?: Record<string, unknown>;
  receipt?: Record<string, unknown>;
  proof?: Record<string, unknown>;
  premiumReport?: Record<string, unknown>;
  settlement?: Record<string, unknown>;
  auditEvents?: unknown;
}

export async function executeDemoFlow(): Promise<DemoRunResult> {
  const cfg = loadDashboardConfig();
  const steps: DemoStep[] = [];

  const step = (label: string): DemoStep => {
    const s: DemoStep = { label, status: "pending" };
    steps.push(s);
    return s;
  };

  const ok = (s: DemoStep, detail?: string) => {
    s.status = "done";
    if (detail) s.detail = detail;
  };

  const fail = (s: DemoStep, detail: string) => {
    s.status = "error";
    s.detail = detail;
  };

  const result: DemoRunResult = {
    success: false,
    mode: cfg.mode,
    steps,
  };

  try {
    // 1. Setup
    const s1 = step("Demo state initialized");
    let setupBody: Record<string, unknown> = {};
    try {
      setupBody = (await api.setupDemo()) as Record<string, unknown>;
      result.policy = setupBody.policy as Record<string, unknown>;
      result.merchant = setupBody.merchant as Record<string, unknown>;
      ok(s1);
    } catch (err) {
      fail(s1, String(err));
      return { ...result, error: "Setup failed" };
    }

    // 2. Call unprotected
    const s2 = step("Agent calls protected resource");
    const resourcePath = cfg.targetUrl.replace(cfg.paidApiBaseUrl, "");
    const unpaid = await fetch(cfg.targetUrl);
    if (unpaid.status !== 402) {
      fail(s2, `Expected 402, got ${unpaid.status}`);
      return { ...result, error: `Expected 402, got ${unpaid.status}` };
    }
    ok(s2);

    // 3. Payment required
    const s3 = step("API returns HTTP 402 PaymentRequired");
    const unpaidBody = (await unpaid.json()) as Record<string, unknown>;
    const requirement = unpaidBody.paymentRequirement;
    if (!requirement) {
      fail(s3, "No paymentRequirement in 402 response");
      return { ...result, error: "No paymentRequirement" };
    }
    result.paymentRequirement = requirement as Record<string, unknown>;
    ok(s3);

    // 4. Authorize
    const s4 = step("Payment authorized under policy");
    let authBody = {} as Record<string, unknown>;
    try {
      authBody = (await api.authorizePayment({
        policyId: cfg.defaultPolicyId,
        agentId: cfg.defaultAgentId,
        requirement,
      })) as Record<string, unknown>;
      result.authorization = authBody.authorization as Record<string, unknown>;
      result.receipt = authBody.receipt as Record<string, unknown>;
      result.proof = authBody.proof as Record<string, unknown>;
      ok(s4);
    } catch (err) {
      fail(s4, String(err));
      return { ...result, error: "Authorization failed" };
    }

    // 5. Retry with receipt
    const s5 = step("Agent retries with request-bound receipt");
    const retryRes = await fetch(cfg.targetUrl, {
      headers: {
        "X-AgentPay-Receipt": JSON.stringify(authBody.receipt),
        "Content-Type": "application/json",
      },
    });
    if (retryRes.status !== 200) {
      fail(s5, `Retry got ${retryRes.status}`);
      return { ...result, error: "Receipt retry failed" };
    }
    const premiumBody = await retryRes.json();
    result.premiumReport = premiumBody as Record<string, unknown>;
    ok(s5);

    // 6. Fulfilled
    ok(step("Payment fulfilled"));
    ok(step("Mock Casper payment escrowed"));

    // 7. Settle
    const settleStep = step("Payment settled");
    if (cfg.autoSettle && authBody.receipt) {
      try {
        const receipt = authBody.receipt as Record<string, unknown>;
        const settleBody = (await api.settlePayment(
          String(receipt.paymentId),
        )) as Record<string, unknown>;
        result.settlement = settleBody as Record<string, unknown>;
        ok(settleStep);
      } catch (err) {
        fail(settleStep, String(err));
      }
    } else {
      ok(settleStep, "Skipped (autoSettle=false)");
    }

    // 8. Audit
    const auditStep = step("Audit trail updated");
    try {
      const auditBody = (await api.getAuditEvents()) as unknown;
      result.auditEvents = auditBody;
      ok(auditStep);
    } catch {
      ok(auditStep, "Audit unavailable");
    }

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
