import express, { type Request, type Response } from "express";

import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  createBodyHash,
  createRequestHash,
  type PaymentRequirement,
} from "@cspr-agentpay/protocol";

export function createPaidApiServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, mode: process.env.AGENTPAY_MODE ?? "mock" });
  });

  app.get("/premium/report", (req: Request, res: Response) => {
    const agentId = String(req.header("x-agent-id") ?? "agent_research_001");
    const merchantId = process.env.MERCHANT_ID ?? "merchant_market_data_001";
    const endpointId = "premium-report-cspr";

    if (!req.header("x-agentpay-receipt")) {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const nonce = "paid-api-placeholder-nonce";
      const requirement: PaymentRequirement = {
        version: PROTOCOL_VERSION,
        requirementId: "req_paid_api_placeholder",
        merchantId,
        merchantAccount:
          process.env.MERCHANT_ACCOUNT ?? "mock-merchant-account",
        method: req.method,
        url,
        endpointId,
        amount: "1000000000",
        currency: "CSPR",
        requestHash: createRequestHash({
          method: req.method,
          url,
          bodyHash: createBodyHash({}),
          endpointId,
          merchantId,
          agentId,
          nonce,
          expiresAt,
        }),
        nonce,
        termsHash: blake2b256Hex("premium report terms"),
        escrowMode: "authorize_then_settle",
        issuedAt: new Date().toISOString(),
        expiresAt,
      };

      res.status(402).json({ error: "PAYMENT_REQUIRED", requirement });
      return;
    }

    res.json({
      symbol: "CSPR",
      signal: "premium-placeholder",
      releasedBecause: "receipt-present",
      mode: process.env.AGENTPAY_MODE ?? "mock",
    });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? "4000");
  createPaidApiServer().listen(port, () => {
    console.log(`paid-api listening on http://localhost:${port}`);
  });
}
