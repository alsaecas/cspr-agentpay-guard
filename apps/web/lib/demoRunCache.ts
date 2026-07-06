import type { DemoRunResult } from "./demoFlow";

const CACHE_KEY = "agentpay:lastDemoRun";

export interface CachedAuditEvent {
  eventId: string;
  type: string;
  createdAt: string;
  policyId?: string;
  merchantId?: string;
  paymentId?: string;
  status?: string;
  message: string;
}

export function saveDemoRunResult(result: DemoRunResult): void {
  if (typeof window === "undefined" || !result.success) {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // The dashboard can still render the current run result if storage is full.
  }
}

export function loadDemoRunResult(): DemoRunResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as DemoRunResult) : null;
  } catch {
    return null;
  }
}

export function loadCachedAuditEvents(): CachedAuditEvent[] {
  const result = loadDemoRunResult();
  const auditBody = result?.auditEvents as
    | { auditEvents?: CachedAuditEvent[] }
    | undefined;
  return auditBody?.auditEvents ?? [];
}
