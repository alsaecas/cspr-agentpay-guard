import { describe, expect, it } from "vitest";

import { createAgentPayMcpServer } from "../src/index";

describe("mcp server scaffold", () => {
  it("creates a server instance", () => {
    expect(createAgentPayMcpServer()).toBeTruthy();
  });
});
