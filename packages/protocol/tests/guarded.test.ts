import { describe, expect, it } from "vitest";

import {
  createBodyHash,
  createRequestHash,
  normalizeX402PaymentRequired,
} from "../src/index";

describe("guarded x402 normalization", () => {
  it("preserves the official payload and canonicalizes the request URL", () => {
    const expiresAt = "2030-01-01T00:05:00.000Z";
    const bodyHash = createBodyHash({ symbol: "CSPR" });
    const canonicalUrl =
      "https://api.example.test/premium/report?a=1&symbol=CSPR";
    const requestHash = createRequestHash({
      method: "POST",
      url: canonicalUrl,
      bodyHash,
      endpointId: "premium-report",
      merchantId: "merchant-001",
      agentId: "agent-001",
      nonce: "nonce-001",
      expiresAt,
    });
    const original = {
      x402Version: 2,
      resource: {
        url: "https://API.example.test/premium/report?symbol=CSPR&a=1#ignored",
      },
      accepts: [
        {
          scheme: "exact",
          network: "casper:casper-test",
          asset: "CSPR",
          amount: "100",
          payTo: "account-merchant",
          maxTimeoutSeconds: 300,
          extra: {
            agentPayGuard: {
              merchantId: "merchant-001",
              nonce: "nonce-001",
              issuedAt: "2030-01-01T00:00:00.000Z",
              expiresAt,
              requestHash,
              bodyHash,
            },
          },
        },
      ],
    };

    const normalized = normalizeX402PaymentRequired({
      paymentRequired: original,
      method: "post",
      url: canonicalUrl,
      body: { symbol: "CSPR" },
      agentId: "agent-001",
      endpointId: "premium-report",
    });

    expect(normalized.url).toBe(canonicalUrl);
    expect(normalized.method).toBe("POST");
    expect(normalized.requestHash).toBe(requestHash);
    expect(normalized.originalPaymentRequired).toEqual(original);
  });

  it("rejects a requirement without AgentPay guard metadata", () => {
    expect(() =>
      normalizeX402PaymentRequired({
        paymentRequired: {
          x402Version: 2,
          resource: { url: "https://api.example.test/premium" },
          accepts: [
            {
              scheme: "exact",
              network: "casper:casper-test",
              asset: "CSPR",
              amount: "100",
              payTo: "account-merchant",
              maxTimeoutSeconds: 300,
              extra: {},
            },
          ],
        },
        method: "GET",
        url: "https://api.example.test/premium",
        agentId: "agent-001",
      }),
    ).toThrow();
  });
});
