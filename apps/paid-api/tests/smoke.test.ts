import { describe, expect, it } from "vitest";

import { createPaidApiServer } from "../src/server";

describe("paid api scaffold", () => {
  it("creates an express app", () => {
    expect(createPaidApiServer()).toBeTruthy();
  });
});
