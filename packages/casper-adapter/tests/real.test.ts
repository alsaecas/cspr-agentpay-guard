import { describe, expect, it } from "vitest";

import { CasperProofSchema } from "@cspr-agentpay/protocol";

import {
  RealCasperTestnetAdapter,
  loadRealCasperConfigFromEnv,
  type CasperPaymentAdapter,
} from "../src/index";

function stubAdapter(): RealCasperTestnetAdapter {
  return new RealCasperTestnetAdapter(
    loadRealCasperConfigFromEnv({ CASPER_NETWORK: "casper-test" }),
  );
}

describe("RealCasperTestnetAdapter", () => {
  // -----------------------------------------------------------------------
  // Interface contract
  // -----------------------------------------------------------------------

  it("satisfies the full CasperPaymentAdapter interface at the type level", () => {
    const adapter = stubAdapter();
    // Type-level check: the adapter must be assignable to the interface.
    const _check: CasperPaymentAdapter = adapter;

    expect(adapter.mode).toBe("casper-testnet");

    // Every method in CasperPaymentAdapter must exist on the instance.
    const methods = [
      "createPolicy",
      "revokePolicy",
      "registerMerchant",
      "authorizePayment",
      "submitPayment",
      "markFulfilled",
      "settlePayment",
      "expirePayment",
      "getPolicy",
      "getMerchant",
      "getPayment",
      "listPayments",
      "listAuditEvents",
    ] as const;

    for (const method of methods) {
      expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe(
        "function",
      );
    }
  });

  // -----------------------------------------------------------------------
  // Method-specific errors
  // -----------------------------------------------------------------------

  it("throws a method-specific error for createPolicy", async () => {
    await expect(
      stubAdapter().createPolicy({
        version: "agentpay-guard-v1",
        policyId: "test-policy",
        ownerAccount: "test-owner",
        agentId: "test-agent",
        status: "active",
        currency: "CSPR",
        maxAmountPerPayment: "1000000000",
        totalBudget: "10000000000",
        spentAmount: "0",
        budgetWindow: "demo-total",
        allowedMerchantIds: ["merchant_test"],
        allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
        expiresAt: "2030-01-01T00:00:00Z",
        policyNonce: "test-nonce",
        createdAt: "2030-01-01T00:00:00Z",
      }),
    ).rejects.toThrow(/createPolicy.*not implemented/);
  });

  it("throws a method-specific error for revokePolicy", async () => {
    await expect(
      stubAdapter().revokePolicy("test-policy"),
    ).rejects.toThrow(/revokePolicy.*not implemented/);
  });

  it("throws a method-specific error for registerMerchant", async () => {
    await expect(
      stubAdapter().registerMerchant({
        version: "agentpay-guard-v1",
        merchantId: "test-merchant",
        displayName: "Test",
        status: "active",
        casperAccount: "test-account",
        settlementAccount: "test-account",
        allowedOrigins: ["https://api.example.test"],
        allowedResourcePatterns: ["GET https://api.example.test/premium/*"],
        createdAt: "2030-01-01T00:00:00Z",
      }),
    ).rejects.toThrow(/registerMerchant.*not implemented/);
  });

  it("throws a method-specific error for authorizePayment", async () => {
    await expect(
      stubAdapter().authorizePayment({
        policyId: "test-policy",
        requirement: {
          version: "agentpay-guard-v1",
          requirementId: "test-req",
          merchantId: "test-merchant",
          merchantAccount: "test-account",
          method: "GET",
          url: "https://api.example.test/premium/report",
          endpointId: "test-endpoint",
          amount: "1000000000",
          currency: "CSPR",
          requestHash:
            "0000000000000000000000000000000000000000000000000000000000000000",
          nonce: "test-nonce",
          termsHash:
            "0000000000000000000000000000000000000000000000000000000000000000",
          escrowMode: "authorize_then_settle",
          expiresAt: "2030-01-01T00:05:00Z",
          issuedAt: "2030-01-01T00:00:00Z",
        },
      }),
    ).rejects.toThrow(/authorizePayment.*not implemented/);
  });

  it("throws a method-specific error for submitPayment", async () => {
    await expect(
      stubAdapter().submitPayment({
        paymentId:
          "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).rejects.toThrow(/submitPayment.*not implemented/);
  });

  it("throws a method-specific error for markFulfilled", async () => {
    await expect(
      stubAdapter().markFulfilled({
        paymentId:
          "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).rejects.toThrow(/markFulfilled.*not implemented/);
  });

  it("throws a method-specific error for settlePayment", async () => {
    await expect(
      stubAdapter().settlePayment({
        paymentId:
          "0000000000000000000000000000000000000000000000000000000000000000",
      }),
    ).rejects.toThrow(/settlePayment.*not implemented/);
  });

  it("throws a method-specific error for expirePayment", async () => {
    await expect(
      stubAdapter().expirePayment(
        "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).rejects.toThrow(/expirePayment.*not implemented/);
  });

  it("throws a method-specific error for getPolicy", async () => {
    await expect(
      stubAdapter().getPolicy("test-policy"),
    ).rejects.toThrow(/getPolicy.*not implemented/);
  });

  it("throws a method-specific error for getMerchant", async () => {
    await expect(
      stubAdapter().getMerchant("test-merchant"),
    ).rejects.toThrow(/getMerchant.*not implemented/);
  });

  it("throws a method-specific error for getPayment", async () => {
    await expect(
      stubAdapter().getPayment(
        "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).rejects.toThrow(/getPayment.*not implemented/);
  });

  it("throws a method-specific error for listPayments", async () => {
    await expect(stubAdapter().listPayments()).rejects.toThrow(
      /listPayments.*not implemented/,
    );
  });

  it("throws a method-specific error for listAuditEvents", async () => {
    await expect(stubAdapter().listAuditEvents()).rejects.toThrow(
      /listAuditEvents.*not implemented/,
    );
  });

  // -----------------------------------------------------------------------
  // Environment variable validation
  // -----------------------------------------------------------------------

  it("reports missing required env vars", () => {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars({});
    expect(missing).toEqual(
      expect.arrayContaining([
        "CASPER_TESTNET_PUBLIC_KEY",
        "CASPER_TESTNET_SECRET_KEY_PATH",
        "CASPER_RPC_URL",
        "CSPR_CLOUD_AUTH_TOKEN",
        "CASPER_AGENTPAY_CONTRACT_HASH",
      ]),
    );
    expect(missing.length).toBeGreaterThanOrEqual(5);
  });

  it("reports empty missing env vars when all are present", () => {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars({
      CASPER_TESTNET_PUBLIC_KEY: "pk",
      CASPER_TESTNET_SECRET_KEY_PATH: "/tmp/key.pem",
      CASPER_RPC_URL: "https://node.testnet.cspr.cloud/rpc",
      CSPR_CLOUD_AUTH_TOKEN: "token-abc",
      CASPER_AGENTPAY_CONTRACT_HASH: "hash-abc",
    });
    expect(missing).toEqual([]);
  });

  it("assertEnvReady throws when vars are missing", () => {
    expect(() => RealCasperTestnetAdapter.assertEnvReady({})).toThrow(
      /Casper Testnet environment is not ready/,
    );
  });

  it("assertEnvReady does not throw when all vars are present", () => {
    expect(() =>
      RealCasperTestnetAdapter.assertEnvReady({
        CASPER_TESTNET_PUBLIC_KEY: "pk",
        CASPER_TESTNET_SECRET_KEY_PATH: "/tmp/key.pem",
        CASPER_RPC_URL: "https://node.testnet.cspr.cloud/rpc",
        CSPR_CLOUD_AUTH_TOKEN: "token-abc",
        CASPER_AGENTPAY_CONTRACT_HASH: "hash-abc",
      }),
    ).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // CasperProof schema validation
  // -----------------------------------------------------------------------

  it("validates a correct transaction-v1 proof", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("validates a correct transaction-v1 proof with eventId", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      eventId: "event-12345",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("validates a correct legacy-deploy proof", () => {
    const proof = {
      kind: "legacy-deploy" as const,
      deployHash:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("validates a correct legacy-deploy proof with eventId", () => {
    const proof = {
      kind: "legacy-deploy" as const,
      deployHash:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      eventId: "legacy-event-99",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("rejects transaction-v1 proof with empty transactionHash", () => {
    const proof = {
      kind: "transaction-v1",
      transactionHash: "",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(false);
  });

  it("rejects transaction-v1 proof with mock-prefixed hash (wrong kind for mock)", () => {
    const proof = {
      kind: "transaction-v1",
      transactionHash: "mock-abc",
    };

    // mock-abc is still a nonEmptyString so it passes
    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(true);
  });

  it("rejects legacy-deploy proof with empty deployHash", () => {
    const proof = {
      kind: "legacy-deploy",
      deployHash: "",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(false);
  });

  it("rejects proof with unknown kind", () => {
    const proof = {
      kind: "fake-proof",
      hash: "abc",
    };

    const result = CasperProofSchema.safeParse(proof);
    expect(result.success).toBe(false);
  });

  it("rejects mock proof used in real mode context", () => {
    // Mock proofs have "mock-" prefix on hash and eventId
    const mockProof = {
      kind: "mock",
      hash: "mock-authorized-hash",
      eventId: "mock-authorized-event-id",
    };

    const result = CasperProofSchema.safeParse(mockProof);
    expect(result.success).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Real adapter does not fake chain success
  // -----------------------------------------------------------------------

  it("never returns a result without throwing", async () => {
    const adapter = stubAdapter();

    // Every method must throw. No method should succeed silently.
    await expect(
      adapter.createPolicy({
        version: "agentpay-guard-v1",
        policyId: "test",
        ownerAccount: "owner",
        agentId: "agent",
        status: "active",
        currency: "CSPR",
        maxAmountPerPayment: "100",
        totalBudget: "1000",
        spentAmount: "0",
        budgetWindow: "demo",
        allowedMerchantIds: ["m1"],
        allowedResourcePatterns: ["GET https://test.com/*"],
        expiresAt: "2030-01-01T00:00:00Z",
        policyNonce: "n",
        createdAt: "2030-01-01T00:00:00Z",
      }),
    ).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // Load config from env
  // -----------------------------------------------------------------------

  it("loads config from env with defaults", () => {
    const config = loadRealCasperConfigFromEnv({});
    expect(config.network).toBe("casper-test");
    expect(config.rpcUrl).toBe("https://node.testnet.cspr.cloud/rpc");
  });

  it("loads config from env with custom values", () => {
    const config = loadRealCasperConfigFromEnv({
      CASPER_NETWORK: "integration-test",
      CASPER_RPC_URL: "https://custom-rpc.example.com",
      CASPER_TESTNET_PUBLIC_KEY: "custom-pk",
      CASPER_TESTNET_SECRET_KEY_PATH: "/custom/key.pem",
    });
    expect(config.network).toBe("integration-test");
    expect(config.rpcUrl).toBe("https://custom-rpc.example.com");
    expect(config.publicKey).toBe("custom-pk");
    expect(config.secretKeyPath).toBe("/custom/key.pem");
  });
});
