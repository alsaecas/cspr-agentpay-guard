import { randomUUID } from "node:crypto";
import { resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  type AuditEvent,
  type CreateRequestHashInput,
  type Merchant,
  type PaymentReceipt,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PaidApiConfig {
  mode: string;
  agentId: string;
  merchantId: string;
  merchantAccount: string;
  policyId: string;
  port: number;
}

export function loadPaidApiConfig(env: NodeJS.ProcessEnv = process.env): PaidApiConfig {
  return {
    mode: env.AGENTPAY_MODE ?? "mock",
    agentId: env.AGENT_ID ?? "agent_research_001",
    merchantId: env.MERCHANT_ID ?? "merchant_market_data_001",
    merchantAccount: env.MERCHANT_ACCOUNT ?? "mock-merchant-account",
    policyId: env.POLICY_ID ?? "policy_demo_agent_001",
    port: Number(env.PORT ?? "4000"),
  };
}

// ---------------------------------------------------------------------------
// Premium parking report generator
// ---------------------------------------------------------------------------

const PREMIUM_LOTS: Record<string, { location: string }> = {
  "MAD-001": { location: "Madrid" },
  "BCN-001": { location: "Barcelona" },
  "VAL-001": { location: "Valencia" },
};

export interface PremiumReport {
  lotId: string;
  location: string;
  revenue24h: string;
  occupancyRate: number;
  avgTicketSize: string;
  confidenceScore: number;
  generatedAt: string;
  responseHash: string;
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

// ---------------------------------------------------------------------------
// Canonical request-input builder
// ---------------------------------------------------------------------------

/**
 * Build a deterministic CreateRequestHashInput from the current HTTP request
 * plus the fixed demo identity fields.
 *
 * Used both when issuing a PaymentRequirement and when verifying a receipt,
 * so the hash formula never drifts between the two paths.
 */
function buildCanonicalRequestInput(input: {
  method: string;
  originalUrl: string;
  port: number;
  endpointId: string;
  merchantId: string;
  agentId: string;
  nonce: string;
  expiresAt: string;
}): CreateRequestHashInput {
  const url = `http://127.0.0.1:${input.port}${input.originalUrl}`;

  return {
    method: input.method,
    url,
    bodyHash: createBodyHash({}),
    endpointId: input.endpointId,
    merchantId: input.merchantId,
    agentId: input.agentId,
    nonce: input.nonce,
    expiresAt: input.expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Demo state (one instance per server process)
// ---------------------------------------------------------------------------

interface DemoState {
  adapter: CasperPaymentAdapter;
  requirements: Map<string, PaymentRequirement>;
  initialized: boolean;
}

function createInitialState(): DemoState {
  return {
    adapter: new MockCasperPaymentAdapter({ seedDemoData: false }),
    requirements: new Map(),
    initialized: false,
  };
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

interface ApiError {
  error: string;
  message: string;
}

function apiError(res: Response, status: number, error: string, message: string): void {
  res.status(status).json({ error, message } satisfies ApiError);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function createPaidApiServer(config?: PaidApiConfig): express.Application {
  const cfg = config ?? loadPaidApiConfig();
  const app = express();

  app.use(express.json({ type: ["application/json", "text/plain"] }));

  // Shared mutable demo state — scoped to this server instance.
  let state = createInitialState();

  // Factory that returns a fresh state without touching the shared one.
  // Used by /demo/setup to reset the adapter and store.
  function freshState(): DemoState {
    return createInitialState();
  }

  // -----------------------------------------------------------------------
  // GET /health
  // -----------------------------------------------------------------------

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "cspr-agentpay-paid-api",
      mode: cfg.mode,
    });
  });

  // -----------------------------------------------------------------------
  // POST /demo/setup
  // -----------------------------------------------------------------------

  app.post("/demo/setup", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      state = freshState();

      const now = new Date();
      const createdAt = now.toISOString();
      const policyExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const merchant: Merchant = {
        version: PROTOCOL_VERSION,
        merchantId: cfg.merchantId,
        displayName: "Market Data Merchant",
        status: "active",
        casperAccount: cfg.merchantAccount,
        settlementAccount: cfg.merchantAccount,
        allowedOrigins: [`http://localhost:${cfg.port}`, `http://127.0.0.1:${cfg.port}`],
        allowedResourcePatterns: [
          `GET http://localhost:${cfg.port}/premium/parking-report/*`,
          `GET http://127.0.0.1:${cfg.port}/premium/parking-report/*`,
        ],
        createdAt,
      };

      const policy = {
        version: PROTOCOL_VERSION,
        policyId: cfg.policyId,
        ownerAccount: "mock-owner-account",
        agentId: cfg.agentId,
        status: "active" as const,
        currency: "CSPR" as const,
        maxAmountPerPayment: "10000000000",
        totalBudget: "100000000000",
        spentAmount: "0",
        budgetWindow: "demo-total",
        allowedMerchantIds: [cfg.merchantId],
        allowedResourcePatterns: [
          `GET http://localhost:${cfg.port}/premium/parking-report/*`,
          `GET http://127.0.0.1:${cfg.port}/premium/parking-report/*`,
        ],
        expiresAt: policyExpiresAt,
        policyNonce: "policy-nonce-paid-api-001",
        createdAt,
      };

      await state.adapter.registerMerchant(merchant);
      const createdPolicy = await state.adapter.createPolicy(policy);

      state.initialized = true;

      const auditEvents = await state.adapter.listAuditEvents();

      res.json({
        mode: state.adapter.mode,
        merchant,
        policy: createdPolicy,
        auditEvents,
      });
    } catch (err) {
      next(err);
    }
  });

  // -----------------------------------------------------------------------
  // GET /premium/parking-report/:lotId
  // -----------------------------------------------------------------------

  app.get("/premium/parking-report/:lotId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!state.initialized) {
        apiError(res, 503, "DEMO_NOT_INITIALIZED", "Call POST /demo/setup first.");
        return;
      }

      const lotId = String(req.params.lotId ?? "");
      const receiptHeader = req.header("x-agentpay-receipt");

      // -- No receipt header → return 402 Payment Required ------------------

      if (!receiptHeader) {
        const method = req.method;
        const endpointId = "parking-report-v1";
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const issuedAt = new Date().toISOString();
        const nonce = `paid-api-${randomUUID()}`;

        const request = buildCanonicalRequestInput({
          method,
          originalUrl: req.originalUrl,
          port: cfg.port,
          endpointId,
          merchantId: cfg.merchantId,
          agentId: cfg.agentId,
          nonce,
          expiresAt,
        });
        const requestHash = createRequestHash(request);

        const requirement: PaymentRequirement = {
          version: PROTOCOL_VERSION,
          requirementId: `req_${randomUUID()}`,
          merchantId: cfg.merchantId,
          merchantAccount: cfg.merchantAccount,
          method,
          url: request.url,
          endpointId,
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

        res.status(402).json({
          error: "PAYMENT_REQUIRED",
          paymentRequirement: requirement,
        });
        return;
      }

      // -- Receipt header present → validate and release premium data -------

      let receipt: PaymentReceipt;
      try {
        receipt = PaymentReceiptSchema.parse(JSON.parse(receiptHeader));
      } catch {
        apiError(res, 400, "MALFORMED_RECEIPT", "The X-AgentPay-Receipt header could not be parsed or validated.");
        return;
      }

      // Look up original requirement by requestHash.
      const requirement = state.requirements.get(receipt.requestHash);
      if (!requirement) {
        apiError(res, 404, "RECEIPT_NOT_FOUND", "No requirement was issued for this requestHash.");
        return;
      }

      // Rebuild the request-hash input from the CURRENT HTTP request, reusing
      // the stored requirement's nonce, endpointId, and expiry.  This ensures
      // the receipt is bound to the exact current URL — a receipt issued for
      // /MAD-001 will not pass verification on /BCN-001.
      const currentRequest = buildCanonicalRequestInput({
        method: req.method,
        originalUrl: req.originalUrl,
        port: cfg.port,
        endpointId: requirement.endpointId,
        merchantId: cfg.merchantId,
        agentId: cfg.agentId,
        nonce: requirement.nonce,
        expiresAt: requirement.expiresAt,
      });
      const currentRequestHash = createRequestHash(currentRequest);

      if (receipt.requestHash !== currentRequestHash) {
        apiError(
          res,
          403,
          "REQUEST_HASH_MISMATCH",
          "Receipt requestHash does not match the current request. A receipt issued for one URL cannot be used for another.",
        );
        return;
      }

      if (receipt.merchantId !== requirement.merchantId) {
        apiError(res, 403, "MERCHANT_MISMATCH", "Receipt merchantId does not match the issued requirement.");
        return;
      }

      if (receipt.endpointId !== requirement.endpointId) {
        apiError(res, 403, "ENDPOINT_MISMATCH", "Receipt endpointId does not match the issued requirement.");
        return;
      }

      if (receipt.amount !== requirement.amount) {
        apiError(res, 403, "AMOUNT_MISMATCH", "Receipt amount does not match the issued requirement.");
        return;
      }

      if (receipt.currency !== requirement.currency) {
        apiError(res, 403, "CURRENCY_MISMATCH", "Receipt currency does not match the issued requirement.");
        return;
      }

      if (new Date(requirement.expiresAt).getTime() <= Date.now()) {
        apiError(res, 410, "REQUIREMENT_EXPIRED", "The payment requirement has expired.");
        return;
      }

      if (receipt.status !== "escrowed" && receipt.status !== "settled" && receipt.status !== "fulfilled") {
        apiError(
          res,
          402,
          "PAYMENT_NOT_ESCROWED",
          `Receipt status is '${receipt.status}'. Payment must be escrowed, fulfilled, or settled to release data.`,
        );
        return;
      }

      if (cfg.mode === "mock" && receipt.proof.kind !== "mock") {
        apiError(res, 403, "MOCK_MODE_NOT_ALLOWED", "Mock mode requires mock-proof receipts.");
        return;
      }

      // Verify receipt exists in the adapter and matches.
      const adapterReceipt = await state.adapter.getPayment(receipt.paymentId);
      if (!adapterReceipt) {
        apiError(res, 404, "PAYMENT_NOT_FOUND", "Receipt paymentId is not known to the adapter.");
        return;
      }

      if (adapterReceipt.status !== "escrowed" && adapterReceipt.status !== "settled" && adapterReceipt.status !== "fulfilled") {
        apiError(
          res,
          402,
          "PAYMENT_NOT_ESCROWED",
          `Adapter payment status is '${adapterReceipt.status}'. Must be escrowed, fulfilled, or settled.`,
        );
        return;
      }

      // All checks passed — release premium data.
      const report = generatePremiumReport(lotId);

      try {
        await state.adapter.markFulfilled({
          paymentId: receipt.paymentId,
          responseBody: report,
          responseHash: report.responseHash,
        });
      } catch {
        // markFulfilled may throw if the transition is invalid (e.g. already fulfilled).
        // If the payment was already fulfilled, the data can still be released.
      }

      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  // -----------------------------------------------------------------------
  // POST /demo/authorize
  // -----------------------------------------------------------------------

  app.post("/demo/authorize", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!state.initialized) {
        apiError(res, 503, "DEMO_NOT_INITIALIZED", "Call POST /demo/setup first.");
        return;
      }

      const { policyId, requirement, agentId } =
        req.body as {
          policyId?: string;
          requirement?: PaymentRequirement;
          agentId?: string;
        };

      if (!policyId || !requirement || !agentId) {
        apiError(res, 400, "MALFORMED_REQUEST", "Required fields: policyId, requirement, agentId.");
        return;
      }

      // Rebuild CreateRequestHashInput from the requirement.
      const request: CreateRequestHashInput = {
        method: requirement.method,
        url: requirement.url,
        bodyHash: createBodyHash({}),
        endpointId: requirement.endpointId,
        merchantId: requirement.merchantId,
        agentId,
        nonce: requirement.nonce,
        expiresAt: requirement.expiresAt,
      };

      const authorizationResult = await state.adapter.authorizePayment({
        policyId,
        requirement,
        request,
      });

      const receipt = await state.adapter.submitPayment({
        paymentId: authorizationResult.authorization.paymentId,
      });

      const auditEvents = await state.adapter.listAuditEvents();

      res.json({
        authorization: authorizationResult.authorization,
        receipt,
        proof: receipt.proof,
        updatedPolicy: authorizationResult.updatedPolicy,
        auditEvents,
      });
    } catch (err) {
      next(err);
    }
  });

  // -----------------------------------------------------------------------
  // POST /demo/settle/:paymentId
  // -----------------------------------------------------------------------

  app.post("/demo/settle/:paymentId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!state.initialized) {
        apiError(res, 503, "DEMO_NOT_INITIALIZED", "Call POST /demo/setup first.");
        return;
      }

      const paymentId = String(req.params.paymentId ?? "");
      if (!paymentId) {
        apiError(res, 400, "MALFORMED_REQUEST", "Missing paymentId path parameter.");
        return;
      }

      const payment = await state.adapter.getPayment(paymentId);
      if (!payment) {
        apiError(res, 404, "PAYMENT_NOT_FOUND", `No payment found for paymentId ${paymentId}.`);
        return;
      }

      // Only reject payments that can never be settled (terminal/early states).
      // The adapter handles the fulfilled-only and duplicate-settlement checks internally.
      if (payment.status === "authorized" || payment.status === "submitted" || payment.status === "escrowed") {
        apiError(
          res,
          409,
          "INVALID_STATE_TRANSITION",
          `Payment status is '${payment.status}'. Only fulfilled payments can be settled.`,
        );
        return;
      }

      let settlement;
      try {
        settlement = await state.adapter.settlePayment({ paymentId });
      } catch (settleErr) {
        const msg = settleErr instanceof Error ? settleErr.message : "";
        if (msg.includes("DUPLICATE_SETTLEMENT")) {
          apiError(res, 409, "DUPLICATE_SETTLEMENT", msg);
          return;
        }
        if (msg.includes("INVALID_STATE_TRANSITION")) {
          apiError(res, 409, "INVALID_STATE_TRANSITION", msg);
          return;
        }
        throw settleErr;
      }

      const updatedPayment = await state.adapter.getPayment(paymentId);
      const auditEvents = await state.adapter.listAuditEvents({ paymentId });

      res.json({
        settlement,
        payment: updatedPayment,
        auditEvents,
      });
    } catch (err) {
      next(err);
    }
  });

  // -----------------------------------------------------------------------
  // GET /demo/audit
  // -----------------------------------------------------------------------

  app.get("/demo/audit", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!state.initialized) {
        apiError(res, 503, "DEMO_NOT_INITIALIZED", "Call POST /demo/setup first.");
        return;
      }

      const events = await state.adapter.listAuditEvents();
      res.json({ auditEvents: events });
    } catch (err) {
      next(err);
    }
  });

  // -----------------------------------------------------------------------
  // Error handler
  // -----------------------------------------------------------------------

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("paid-api error:", message);
    apiError(res, 500, "INTERNAL_ERROR", message);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Server start (when run directly, not imported by tests)
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1]
  ? pathResolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun && process.env.NODE_ENV !== "test") {
  const config = loadPaidApiConfig();
  const server = createPaidApiServer(config);
  server.listen(config.port, () => {
    console.log(`paid-api listening on http://localhost:${config.port}`);
  });
}
