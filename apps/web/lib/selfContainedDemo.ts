import { randomUUID } from "node:crypto";

import {
  MockCasperPaymentAdapter,
  type CasperPaymentAdapter,
} from "@cspr-agentpay/casper-adapter";
import {
  PROTOCOL_VERSION,
  PaymentReceiptSchema,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  createResponseHash,
  type AgentPolicy,
  type AuditEvent,
  type CreateRequestHashInput,
  type Merchant,
  type PaymentReceipt,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";

import {
  loadDashboardConfig,
  type AgentPayDashboardConfig,
} from "./agentpayConfig";
import type { DemoRunResult, DemoStep } from "./demoFlow";

const MERCHANT_ID = "merchant_market_data_001";
const MERCHANT_ACCOUNT = "mock-merchant-account";
const ENDPOINT_ID = "parking-report-v1";
const DEFAULT_LOT_ID = "MAD-001";
const RESOURCE_PATH_PREFIX = "/premium/parking-report";

const PREMIUM_LOTS: Record<string, { location: string }> = {
  "MAD-001": { location: "Madrid" },
  "BCN-001": { location: "Barcelona" },
  "VAL-001": { location: "Valencia" },
};

interface DemoState {
  adapter: CasperPaymentAdapter;
  requirements: Map<string, PaymentRequirement>;
  syntheticAuditEvents: AuditEvent[];
  initialized: boolean;
  latestRunResult: DemoRunResult | null;
}

interface DemoSetupResult {
  mode: string;
  backend: "self-contained";
  merchant: Merchant;
  policy: AgentPolicy;
  auditEvents: AuditEvent[];
}

type SimulatedPaidResponse =
  | { status: 200; body: PremiumReport }
  | {
      status: 402;
      body: {
        error: "PAYMENT_REQUIRED";
        paymentRequirement: PaymentRequirement;
      };
    }
  | { status: number; body: { error: string; message: string } };

interface PremiumReport {
  lotId: string;
  location: string;
  revenue24h: string;
  occupancyRate: number;
  avgTicketSize: string;
  confidenceScore: number;
  generatedAt: string;
  responseHash: string;
}

type GlobalWithDemoState = typeof globalThis & {
  __agentPayWebDemoState?: DemoState;
};

function createInitialState(): DemoState {
  return {
    adapter: new MockCasperPaymentAdapter({
      seed: "agentpay-web-demo",
      seedDemoData: false,
    }),
    requirements: new Map(),
    syntheticAuditEvents: [],
    initialized: false,
    latestRunResult: null,
  };
}

function getState(): DemoState {
  const globalState = globalThis as GlobalWithDemoState;
  if (!globalState.__agentPayWebDemoState) {
    globalState.__agentPayWebDemoState = createInitialState();
  }
  return globalState.__agentPayWebDemoState;
}

function replaceState(next: DemoState): DemoState {
  const globalState = globalThis as GlobalWithDemoState;
  globalState.__agentPayWebDemoState = next;
  return next;
}

function getResourceUrl(cfg: AgentPayDashboardConfig, lotId = DEFAULT_LOT_ID) {
  const target = new URL(cfg.targetUrl);
  target.pathname = `${RESOURCE_PATH_PREFIX}/${lotId}`;
  target.search = "";
  target.hash = "";
  return target.toString();
}

function buildCanonicalRequestInput(input: {
  method: string;
  url: string;
  endpointId: string;
  merchantId: string;
  agentId: string;
  nonce: string;
  expiresAt: string;
}): CreateRequestHashInput {
  return {
    method: input.method,
    url: input.url,
    bodyHash: createBodyHash({}),
    endpointId: input.endpointId,
    merchantId: input.merchantId,
    agentId: input.agentId,
    nonce: input.nonce,
    expiresAt: input.expiresAt,
  };
}

function generatePremiumReport(lotId: string): PremiumReport {
  const lot = PREMIUM_LOTS[lotId] ?? { location: "Unknown" };
  const generatedAt = new Date().toISOString();

  const report: Omit<PremiumReport, "responseHash"> = {
    lotId,
    location: lot.location,
    revenue24h: "12850.00",
    occupancyRate: 0.87,
    avgTicketSize: "14.20",
    confidenceScore: 0.94,
    generatedAt,
  };

  const responseHash = createResponseHash(report);
  return { ...report, responseHash };
}

function isPaymentRequiredResponse(
  response: SimulatedPaidResponse,
): response is Extract<
  SimulatedPaidResponse,
  { body: { paymentRequirement: PaymentRequirement } }
> {
  return "paymentRequirement" in response.body;
}

function isPremiumResponse(
  response: SimulatedPaidResponse,
): response is Extract<SimulatedPaidResponse, { status: 200 }> {
  return response.status === 200 && "responseHash" in response.body;
}

function makeAuditEventId(kind: string, seed: string): string {
  return `mock-event-${kind}-${blake2b256Hex(`${kind}:${seed}`).slice(0, 32)}`;
}

function getAllowedOrigins(cfg: AgentPayDashboardConfig): string[] {
  const targetOrigin = new URL(cfg.targetUrl).origin;
  return Array.from(
    new Set([
      targetOrigin,
      cfg.publicBaseUrl,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]),
  );
}

function getAllowedResourcePatterns(cfg: AgentPayDashboardConfig): string[] {
  return getAllowedOrigins(cfg).map(
    (origin) => `GET ${origin}${RESOURCE_PATH_PREFIX}/*`,
  );
}

export async function setupSelfContainedDemo(
  cfg = loadDashboardConfig(),
): Promise<DemoSetupResult> {
  const state = replaceState(createInitialState());
  const now = new Date();
  const createdAt = now.toISOString();
  const policyExpiresAt = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();

  const merchant: Merchant = {
    version: PROTOCOL_VERSION,
    merchantId: MERCHANT_ID,
    displayName: "Market Data Merchant",
    status: "active",
    casperAccount: MERCHANT_ACCOUNT,
    settlementAccount: MERCHANT_ACCOUNT,
    allowedOrigins: getAllowedOrigins(cfg),
    allowedResourcePatterns: getAllowedResourcePatterns(cfg),
    createdAt,
  };

  const policy: AgentPolicy = {
    version: PROTOCOL_VERSION,
    policyId: cfg.defaultPolicyId,
    ownerAccount: "mock-owner-account",
    agentId: cfg.defaultAgentId,
    status: "active",
    currency: "CSPR",
    maxAmountPerPayment: "10000000000",
    totalBudget: "100000000000",
    spentAmount: "0",
    budgetWindow: "demo-total",
    allowedMerchantIds: [MERCHANT_ID],
    allowedResourcePatterns: getAllowedResourcePatterns(cfg),
    expiresAt: policyExpiresAt,
    policyNonce: "policy-nonce-web-demo-001",
    createdAt,
  };

  await state.adapter.registerMerchant(merchant);
  const createdPolicy = await state.adapter.createPolicy(policy);
  state.initialized = true;

  const auditEvents = await listSelfContainedAuditEvents();
  return {
    mode: state.adapter.mode,
    backend: "self-contained",
    merchant,
    policy: createdPolicy,
    auditEvents,
  };
}

export async function listSelfContainedAuditEvents(): Promise<AuditEvent[]> {
  const state = getState();
  if (!state.initialized) {
    return [];
  }

  const adapterEvents = await state.adapter.listAuditEvents();
  return [...adapterEvents, ...state.syntheticAuditEvents].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function getLatestSelfContainedRun(): DemoRunResult | null {
  return getState().latestRunResult;
}

async function requestPremiumParkingReport(input: {
  cfg: AgentPayDashboardConfig;
  lotId?: string;
  receipt?: PaymentReceipt;
}): Promise<SimulatedPaidResponse> {
  const state = getState();
  if (!state.initialized) {
    return {
      status: 503,
      body: {
        error: "DEMO_NOT_INITIALIZED",
        message: "Call setup before requesting a paid resource.",
      },
    };
  }

  const lotId = input.lotId ?? DEFAULT_LOT_ID;
  const method = "GET";
  const url = getResourceUrl(input.cfg, lotId);

  if (!input.receipt) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const issuedAt = new Date().toISOString();
    const nonce = `web-demo-${randomUUID()}`;
    const request = buildCanonicalRequestInput({
      method,
      url,
      endpointId: ENDPOINT_ID,
      merchantId: MERCHANT_ID,
      agentId: input.cfg.defaultAgentId,
      nonce,
      expiresAt,
    });
    const requestHash = createRequestHash(request);
    const requirement: PaymentRequirement = {
      version: PROTOCOL_VERSION,
      requirementId: `req_${randomUUID()}`,
      merchantId: MERCHANT_ID,
      merchantAccount: MERCHANT_ACCOUNT,
      method,
      url,
      endpointId: ENDPOINT_ID,
      amount: "1000000000",
      currency: "CSPR",
      requestHash,
      nonce,
      termsHash: blake2b256Hex("premium parking report terms"),
      escrowMode: "authorize_then_settle",
      expiresAt,
      issuedAt,
    };

    state.requirements.set(requestHash, requirement);
    state.syntheticAuditEvents.push({
      eventId: makeAuditEventId("payment-required", requestHash),
      type: "payment_required",
      createdAt: issuedAt,
      merchantId: MERCHANT_ID,
      status: "required",
      message: `Payment required for ${method} ${url}.`,
      metadata: {
        requestHash,
        requirementId: requirement.requirementId,
        amount: requirement.amount,
        currency: requirement.currency,
      },
    });

    return {
      status: 402,
      body: {
        error: "PAYMENT_REQUIRED",
        paymentRequirement: requirement,
      },
    };
  }

  let receipt: PaymentReceipt;
  try {
    receipt = PaymentReceiptSchema.parse(input.receipt);
  } catch {
    return {
      status: 400,
      body: {
        error: "MALFORMED_RECEIPT",
        message: "The payment receipt could not be parsed or validated.",
      },
    };
  }

  const requirement = state.requirements.get(receipt.requestHash);
  if (!requirement) {
    return {
      status: 404,
      body: {
        error: "RECEIPT_NOT_FOUND",
        message: "No requirement was issued for this requestHash.",
      },
    };
  }

  const currentRequest = buildCanonicalRequestInput({
    method,
    url,
    endpointId: requirement.endpointId,
    merchantId: MERCHANT_ID,
    agentId: input.cfg.defaultAgentId,
    nonce: requirement.nonce,
    expiresAt: requirement.expiresAt,
  });
  const currentRequestHash = createRequestHash(currentRequest);

  if (receipt.requestHash !== currentRequestHash) {
    return {
      status: 403,
      body: {
        error: "REQUEST_HASH_MISMATCH",
        message:
          "Receipt requestHash does not match the current request URL, method, nonce, and expiry.",
      },
    };
  }

  if (receipt.merchantId !== requirement.merchantId) {
    return {
      status: 403,
      body: {
        error: "MERCHANT_MISMATCH",
        message: "Receipt merchantId does not match the issued requirement.",
      },
    };
  }

  if (receipt.endpointId !== requirement.endpointId) {
    return {
      status: 403,
      body: {
        error: "ENDPOINT_MISMATCH",
        message: "Receipt endpointId does not match the issued requirement.",
      },
    };
  }

  if (receipt.amount !== requirement.amount) {
    return {
      status: 403,
      body: {
        error: "AMOUNT_MISMATCH",
        message: "Receipt amount does not match the issued requirement.",
      },
    };
  }

  if (receipt.currency !== requirement.currency) {
    return {
      status: 403,
      body: {
        error: "CURRENCY_MISMATCH",
        message: "Receipt currency does not match the issued requirement.",
      },
    };
  }

  if (new Date(requirement.expiresAt).getTime() <= Date.now()) {
    return {
      status: 410,
      body: {
        error: "REQUIREMENT_EXPIRED",
        message: "The payment requirement has expired.",
      },
    };
  }

  if (
    receipt.status !== "escrowed" &&
    receipt.status !== "settled" &&
    receipt.status !== "fulfilled"
  ) {
    return {
      status: 402,
      body: {
        error: "PAYMENT_NOT_ESCROWED",
        message: `Receipt status is '${receipt.status}'. Payment must be escrowed, fulfilled, or settled to release data.`,
      },
    };
  }

  if (input.cfg.mode === "mock" && receipt.proof.kind !== "mock") {
    return {
      status: 403,
      body: {
        error: "MOCK_MODE_NOT_ALLOWED",
        message: "Mock mode requires mock-proof receipts.",
      },
    };
  }

  const adapterReceipt = await state.adapter.getPayment(receipt.paymentId);
  if (!adapterReceipt) {
    return {
      status: 404,
      body: {
        error: "PAYMENT_NOT_FOUND",
        message: "Receipt paymentId is not known to the adapter.",
      },
    };
  }

  if (
    adapterReceipt.status !== "escrowed" &&
    adapterReceipt.status !== "settled" &&
    adapterReceipt.status !== "fulfilled"
  ) {
    return {
      status: 402,
      body: {
        error: "PAYMENT_NOT_ESCROWED",
        message: `Adapter payment status is '${adapterReceipt.status}'. Must be escrowed, fulfilled, or settled.`,
      },
    };
  }

  const report = generatePremiumReport(lotId);

  try {
    await state.adapter.markFulfilled({
      paymentId: receipt.paymentId,
      responseBody: report,
      responseHash: report.responseHash,
    });
  } catch {
    // A second valid retry can still read the already fulfilled resource.
  }

  return {
    status: 200,
    body: report,
  };
}

async function authorizeSelfContainedPayment(input: {
  cfg: AgentPayDashboardConfig;
  requirement: PaymentRequirement;
}) {
  const state = getState();
  const request = buildCanonicalRequestInput({
    method: input.requirement.method,
    url: input.requirement.url,
    endpointId: input.requirement.endpointId,
    merchantId: input.requirement.merchantId,
    agentId: input.cfg.defaultAgentId,
    nonce: input.requirement.nonce,
    expiresAt: input.requirement.expiresAt,
  });

  const authorizationResult = await state.adapter.authorizePayment({
    policyId: input.cfg.defaultPolicyId,
    requirement: input.requirement,
    request,
  });

  const receipt = await state.adapter.submitPayment({
    paymentId: authorizationResult.authorization.paymentId,
  });

  return {
    authorization: authorizationResult.authorization,
    receipt,
    proof: receipt.proof,
    updatedPolicy: authorizationResult.updatedPolicy,
    auditEvents: await listSelfContainedAuditEvents(),
  };
}

async function settleSelfContainedPayment(paymentId: string) {
  const state = getState();
  const payment = await state.adapter.getPayment(paymentId);
  if (!payment) {
    throw new Error(`PAYMENT_NOT_FOUND: ${paymentId}`);
  }

  if (
    payment.status === "authorized" ||
    payment.status === "submitted" ||
    payment.status === "escrowed"
  ) {
    throw new Error(
      `INVALID_STATE_TRANSITION: payment is '${payment.status}', expected fulfilled.`,
    );
  }

  const settlement = await state.adapter.settlePayment({ paymentId });
  const updatedPayment = await state.adapter.getPayment(paymentId);
  const auditEvents = await listSelfContainedAuditEvents();

  return {
    settlement,
    payment: updatedPayment,
    auditEvents,
  };
}

export async function executeSelfContainedDemoFlow(
  cfg = loadDashboardConfig(),
): Promise<DemoRunResult> {
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
    const s1 = step("Demo state initialized");
    const setupBody = await setupSelfContainedDemo(cfg);
    result.policy = setupBody.policy as unknown as Record<string, unknown>;
    result.merchant = setupBody.merchant as unknown as Record<string, unknown>;
    ok(s1, "Next.js API route initialized Vercel-safe demo state");

    const s2 = step("Agent calls protected resource");
    const unpaid = await requestPremiumParkingReport({ cfg });
    if (!isPaymentRequiredResponse(unpaid)) {
      fail(s2, `Expected 402, got ${unpaid.status}`);
      return { ...result, error: `Expected 402, got ${unpaid.status}` };
    }
    ok(s2);

    const s3 = step("API returns HTTP 402 PaymentRequired");
    const requirement = unpaid.body.paymentRequirement;
    result.paymentRequirement = requirement as unknown as Record<
      string,
      unknown
    >;
    ok(s3);

    const s4 = step("Payment authorized under policy");
    let authBody: Awaited<ReturnType<typeof authorizeSelfContainedPayment>>;
    try {
      authBody = await authorizeSelfContainedPayment({ cfg, requirement });
      result.authorization = authBody.authorization as unknown as Record<
        string,
        unknown
      >;
      result.receipt = authBody.receipt as unknown as Record<string, unknown>;
      result.proof = authBody.proof as unknown as Record<string, unknown>;
      ok(s4);
    } catch (err) {
      fail(s4, String(err));
      return { ...result, error: "Authorization failed" };
    }

    ok(step("Mock Casper payment escrowed"));

    const s6 = step("Agent retries with request-bound receipt");
    const retryRes = await requestPremiumParkingReport({
      cfg,
      receipt: authBody.receipt,
    });
    if (!isPremiumResponse(retryRes)) {
      fail(s6, `Retry got ${retryRes.status}`);
      return { ...result, error: "Receipt retry failed" };
    }
    result.premiumReport = retryRes.body as unknown as Record<string, unknown>;
    ok(s6);

    ok(step("Premium parking data returned"));
    ok(step("Payment fulfilled"));

    const settleStep = step("Payment settled");
    if (cfg.autoSettle) {
      try {
        const settleBody = await settleSelfContainedPayment(
          authBody.receipt.paymentId,
        );
        result.settlement = settleBody as unknown as Record<string, unknown>;
        ok(settleStep);
      } catch (err) {
        fail(settleStep, String(err));
      }
    } else {
      ok(settleStep, "Skipped (autoSettle=false)");
    }

    const auditStep = step("Audit trail updated");
    result.auditEvents = {
      auditEvents: await listSelfContainedAuditEvents(),
    };
    ok(auditStep);

    result.success = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  getState().latestRunResult = result;
  return result;
}
