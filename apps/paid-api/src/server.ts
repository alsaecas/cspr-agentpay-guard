import express, { type Request, type Response } from "express";

import {
  PROTOCOL_VERSION,
  blake2b256Hex,
  computeRequestHash,
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
    const resourceId = "premium-report-cspr";

    if (!req.header("x-agentpay-receipt")) {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const requirement: PaymentRequirement = {
        version: PROTOCOL_VERSION,
        requirementId: "req_paid_api_placeholder",
        merchantId,
        merchantAccount:
          process.env.MERCHANT_ACCOUNT ?? "mock-merchant-account",
        method: req.method,
        url,
        resourceId,
        amount: "1000000000",
        currency: "CSPR",
        requestHash: computeRequestHash({
          method: req.method,
          url,
          resourceId,
          merchantId,
          agentId,
          body: {},
          headers: {
            "content-type": req.header("content-type"),
            "x-agent-id": agentId,
            "x-merchant-id": merchantId,
            "x-resource-id": resourceId,
          },
        }),
        requirementNonce: "paid-api-placeholder-nonce",
        termsHash: blake2b256Hex("premium report terms"),
        escrowMode: "authorize_then_settle",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
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
