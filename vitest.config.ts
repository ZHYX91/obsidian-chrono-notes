import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup/obsidian-dom.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
