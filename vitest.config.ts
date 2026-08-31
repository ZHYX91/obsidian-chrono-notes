import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup/obsidian-dom.ts"],
    coverage: {
      exclude: ["scripts/vendor/**"],
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 82,
        branches: 78,
        functions: 79,
        lines: 83,
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
