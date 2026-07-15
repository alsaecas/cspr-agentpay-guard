import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  oxc: false,
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
  },
});
