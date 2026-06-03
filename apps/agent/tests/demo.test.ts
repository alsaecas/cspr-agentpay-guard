import { describe, expect, it } from "vitest";

import { runMockAgentDemo } from "../src/demo";

describe("mock agent demo", () => {
  it("returns a mock Casper proof path", async () => {
    const result = await runMockAgentDemo();

    expect(result.mode).toBe("mock");
    expect(result.receiptDeployHash).toContain("mock-deploy-");
    expect(result.settlementDeployHash).toContain("mock-settlement-deploy-");
  });
});
