import { describe, expect, it } from "vitest";

import {
  createBodyHash,
  createPaymentId,
  createRequestHash,
  createResponseHash,
} from "../src/index";

describe("protocol hashes", () => {
  it("computes deterministic request hashes with normalized query order", () => {
    const left = createRequestHash({
      method: "get",
      url: "https://api.example.test/premium/report?symbol=CSPR&kind=daily",
      bodyHash: createBodyHash({ symbol: "CSPR" }),
      endpointId: "premium-report-cspr",
      nonce: "request-nonce",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
    const right = createRequestHash({
      method: "GET",
      url: "https://api.example.test/premium/report?kind=daily&symbol=CSPR",
      bodyHash: createBodyHash({ symbol: "CSPR" }),
      endpointId: "premium-report-cspr",
      nonce: "request-nonce",
      expiresAt: "2030-01-01T00:00:00Z",
    });

    expect(left).toEqual(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different request hashes for different URLs", () => {
    const base = requestHashInput();
    const left = createRequestHash(base);
    const right = createRequestHash({
      ...base,
      url: "https://api.example.test/premium/report?symbol=ETH",
    });

    expect(left).not.toEqual(right);
  });

  it("produces different request hashes for different bodies", () => {
    const base = requestHashInput();
    const left = createRequestHash({
      ...base,
      bodyHash: createBodyHash({ symbol: "CSPR" }),
    });
    const right = createRequestHash({
      ...base,
      bodyHash: createBodyHash({ symbol: "ETH" }),
    });

    expect(left).not.toEqual(right);
  });

  it("produces different payment IDs for different nonces", () => {
    const requestHash = createRequestHash(requestHashInput());
    const left = createPaymentId({
      policyId: "policy_demo_agent_001",
      merchantAccount: "mock-merchant-account",
      amount: "1000000000",
      endpointId: "premium-report-cspr",
      requestHash,
      nonce: "authorization-nonce-left",
    });
    const right = createPaymentId({
      policyId: "policy_demo_agent_001",
      merchantAccount: "mock-merchant-account",
      amount: "1000000000",
      endpointId: "premium-report-cspr",
      requestHash,
      nonce: "authorization-nonce-right",
    });

    expect(left).not.toEqual(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computes deterministic response hashes", () => {
    const left = createResponseHash({ data: ["a", "b"], ok: true });
    const right = createResponseHash({ ok: true, data: ["a", "b"] });

    expect(left).toEqual(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });
});

function requestHashInput() {
  return {
    method: "GET",
    url: "https://api.example.test/premium/report?symbol=CSPR",
    bodyHash: createBodyHash({ symbol: "CSPR" }),
    endpointId: "premium-report-cspr",
    nonce: "request-nonce",
    expiresAt: "2030-01-01T00:00:00.000Z",
  };
}
