import { describe, expect, it } from "vitest";

import {
  CASPER_PAYMENT_AUTHORIZATION_VERSION,
  createCasperPaymentAuthorizationHash,
  validateCasperPaymentAuthorization,
  type CasperPaymentAuthorization,
} from "../src/index";

const fixture: CasperPaymentAuthorization = {
  version: CASPER_PAYMENT_AUTHORIZATION_VERSION,
  paymentId: "11".repeat(32),
  policyId: "policy-001",
  agentId: "agent-001",
  requestHash: "22".repeat(32),
  bodyHash: "33".repeat(32),
  merchantId: "merchant-001",
  destination: `01${"44".repeat(32)}`,
  network: "casper-test",
  asset: "CSPR",
  amountMotes: "2500000000",
  nonce: "nonce-001",
  transferId: "123456789",
  issuedAt: "2030-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:05:00.000Z",
  facilitator: "https://merchant.example.test",
  requirementHash: "55".repeat(32),
};

describe("Casper payment authorization", () => {
  it("matches the fixed canonical hash vector", () => {
    expect(createCasperPaymentAuthorizationHash(fixture)).toBe(
      "5111fd055ddd4f42ef4e18df8939bf78c4c1fc1258a04ace84997b963832300e",
    );
  });

  it.each(["destination", "amountMotes", "requestHash"] as const)(
    "binds %s into the hash",
    (field) => {
      const changed = {
        ...fixture,
        [field]:
          field === "amountMotes"
            ? "2500000001"
            : field === "requestHash"
              ? "66".repeat(32)
              : `01${"77".repeat(32)}`,
      };
      expect(createCasperPaymentAuthorizationHash(changed)).not.toBe(
        createCasperPaymentAuthorizationHash(fixture),
      );
    },
  );

  it("rejects expired, zero-value, and malformed-destination intents", () => {
    expect(() =>
      validateCasperPaymentAuthorization(fixture, {
        now: new Date("2030-01-01T00:05:00Z"),
      }),
    ).toThrow("AUTHORIZATION_EXPIRED");
    expect(() =>
      validateCasperPaymentAuthorization({ ...fixture, amountMotes: "0" }),
    ).toThrow();
    expect(() =>
      validateCasperPaymentAuthorization({
        ...fixture,
        destination: "not-an-account",
      }),
    ).toThrow();
  });
});
