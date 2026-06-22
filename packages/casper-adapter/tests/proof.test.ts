import { describe, expect, it } from "vitest";

import { CasperProofSchema } from "@cspr-agentpay/protocol";

import { RealCasperTestnetAdapter } from "../src/real";

const sampleProofInput = {
  paymentId: "a".repeat(64),
  requestHash: "b".repeat(64),
  policyId: "policy_demo_agent_001",
  merchantId: "merchant_market_data_001",
  status: "escrowed",
  receiptHash: "c".repeat(64),
};

describe("RealCasperTestnetAdapter — proof path", () => {
  // -----------------------------------------------------------------------
  // buildProofDryRun
  // -----------------------------------------------------------------------

  it("buildProofDryRun returns valid payload with mock env", () => {
    const result = RealCasperTestnetAdapter.buildProofDryRun({
      ...sampleProofInput,
      env: {},
    });

    expect(result.proof.kind).toBe("transaction-v1");
    expect(result.payload.paymentId).toBe(sampleProofInput.paymentId);
    expect(result.payload.requestHash).toBe(sampleProofInput.requestHash);
    expect(result.payload.status).toBe("escrowed");
    expect(result.payload.receiptHash).toBe("c".repeat(64));
    expect(result.missingEnvVars.length).toBeGreaterThanOrEqual(3);
  });

  it("buildProofDryRun proof schema fails with missing transactionHash", () => {
    const result = RealCasperTestnetAdapter.buildProofDryRun({
      ...sampleProofInput,
      env: {},
    });

    // Empty env means no contract hash → transactionHash is undefined.
    // Schema validation fails because transactionHash is required for transaction-v1.
    const parseResult = CasperProofSchema.safeParse(result.proof);
    expect(parseResult.success).toBe(false);
  });

  it("buildProofDryRun does not produce mock proof", () => {
    const result = RealCasperTestnetAdapter.buildProofDryRun({
      ...sampleProofInput,
      env: {},
    });

    expect(result.proof.kind).not.toBe("mock");
  });

  // -----------------------------------------------------------------------
  // recordAgentPayProof
  // -----------------------------------------------------------------------

  it("recordAgentPayProof returns not-submitted when env vars are missing", async () => {
    const result = await RealCasperTestnetAdapter.recordAgentPayProof({
      ...sampleProofInput,
      env: {},
    });

    expect(result.submitted).toBe(false);
    expect(result.message).toContain("Cannot submit");
    expect(result.message).toContain("Missing env vars");
    expect(result.proof.kind).toBe("transaction-v1");
  });

  it("recordAgentPayProof does not fake real success", async () => {
    // Even with fake env vars, the method is a skeleton and returns submitted=false.
    const result = await RealCasperTestnetAdapter.recordAgentPayProof({
      ...sampleProofInput,
      env: {
        CASPER_TESTNET_PUBLIC_KEY: "fake-pk",
        CASPER_TESTNET_SECRET_KEY_PATH: "/fake/key.pem",
        CASPER_RPC_URL: "https://fake.rpc",
        CSPR_CLOUD_AUTH_TOKEN: "fake-token",
        CASPER_AGENTPAY_CONTRACT_HASH: "f".repeat(64),
      },
    });

    // Even with all vars set, the skeleton does not submit.
    expect(result.submitted).toBe(false);
    expect(result.message).toContain("skeleton");
  });

  // -----------------------------------------------------------------------
  // env validation
  // -----------------------------------------------------------------------

  it("getMissingEnvVars reports required vars", () => {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars({});
    expect(missing).toContain("CASPER_TESTNET_PUBLIC_KEY");
    expect(missing).toContain("CASPER_TESTNET_SECRET_KEY_PATH");
    expect(missing).toContain("CASPER_RPC_URL");
    expect(missing).toContain("CSPR_CLOUD_AUTH_TOKEN");
    expect(missing).toContain("CASPER_AGENTPAY_CONTRACT_HASH");
  });

  it("getMissingEnvVars returns empty when all vars are set", () => {
    const missing = RealCasperTestnetAdapter.getMissingEnvVars({
      CASPER_TESTNET_PUBLIC_KEY: "pk",
      CASPER_TESTNET_SECRET_KEY_PATH: "/tmp/key",
      CASPER_RPC_URL: "https://rpc",
      CSPR_CLOUD_AUTH_TOKEN: "token",
      CASPER_AGENTPAY_CONTRACT_HASH: "hash",
    });
    expect(missing).toEqual([]);
  });

  it("assertEnvReady throws when vars are missing", () => {
    expect(() => RealCasperTestnetAdapter.assertEnvReady({})).toThrow(
      "Casper Testnet environment is not ready",
    );
  });

  it("assertEnvReady does not throw when all vars are present", () => {
    expect(() =>
      RealCasperTestnetAdapter.assertEnvReady({
        CASPER_TESTNET_PUBLIC_KEY: "pk",
        CASPER_TESTNET_SECRET_KEY_PATH: "/tmp/key",
        CASPER_RPC_URL: "https://rpc",
        CSPR_CLOUD_AUTH_TOKEN: "token",
        CASPER_AGENTPAY_CONTRACT_HASH: "hash",
      }),
    ).not.toThrow();
  });

  // -----------------------------------------------------------------------
  // CasperProof schema validation
  // -----------------------------------------------------------------------

  it("transaction-v1 proof with valid 64-char hex passes schema", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash: "a".repeat(64),
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(true);
  });

  it("transaction-v1 proof with uppercase hex passes schema", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash: "A".repeat(64),
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(true);
  });

  it("transaction-v1 proof with short hash fails schema", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash: "abc",
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(false);
  });

  it("transaction-v1 proof with mock prefix fails schema (not 64-char hex)", () => {
    const proof = {
      kind: "transaction-v1" as const,
      transactionHash: "mock-abc",
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(false);
  });

  it("legacy-deploy proof with valid 64-char hex passes schema", () => {
    const proof = {
      kind: "legacy-deploy" as const,
      deployHash: "b".repeat(64),
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(true);
  });

  it("legacy-deploy proof with mock prefix fails schema", () => {
    const proof = {
      kind: "legacy-deploy" as const,
      deployHash: "mock-abc",
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(false);
  });

  it("mock proof still validates correctly", () => {
    const proof = {
      kind: "mock" as const,
      hash: "mock-authorized-abc123",
      eventId: "mock-authorized-event-abc123",
    };
    expect(CasperProofSchema.safeParse(proof).success).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Real adapter does not produce mock proofs
  // -----------------------------------------------------------------------

  it("RealCasperTestnetAdapter buildProofDryRun never returns kind mock", () => {
    const result = RealCasperTestnetAdapter.buildProofDryRun({
      ...sampleProofInput,
    });
    expect(result.proof.kind).not.toBe("mock");
  });
});
