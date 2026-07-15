import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/judge",
}));

import JudgePage from "../app/judge/page";

describe("Judge Mode rendered route content", () => {
  it("renders the judge story and public evidence without a spend control", () => {
    const html = renderToStaticMarkup(React.createElement(JudgePage));

    expect(html).toContain("Firewall for AI Wallets");
    expect(html).toContain("1. Allowed request");
    expect(html).toContain("2. Prompt-injection attack");
    expect(html).toContain("3. Replay attack");
    expect(html).toContain(
      "801d558b18be546ebe18ff884541d451428dacc92e17c8a6c6a33df4d8b4440f",
    );
    expect(html).toContain("MCP Agent Interface");
    expect(html).toContain("Real versus hosted");
    expect(html).toContain("payee public key");
    expect(html).toContain("payee account hash");
    expect(html).not.toMatch(/>\s*(?:spend|pay now|submit payment)\s*</i);
  });
});
