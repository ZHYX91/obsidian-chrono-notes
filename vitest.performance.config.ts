import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  define: {
    __CHRONO_BENCHMARK_NOTE_COUNT__: JSON.stringify(mode === "large" ? 10_000 : 1_000),
  },
  test: {
    environment: "node",
    // Expose gc() so heap guardrails sample collected memory instead of noise.
    execArgv: ["--expose-gc"],
    fileParallelism: false,
    include: ["benchmarks/**/*.test.ts"],
    testTimeout: 180_000,
  },
}));
