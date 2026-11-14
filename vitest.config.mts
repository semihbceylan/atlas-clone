import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest only runs the framework-free market logic (`src/lib/market`), so it
 * needs no DOM environment — just the `@/*` path alias that the app uses.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
