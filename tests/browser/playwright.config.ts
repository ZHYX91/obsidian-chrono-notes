import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 20_000,
  outputDir: "../../test-results/browser",
  reporter: [["list"], ["json", { outputFile: fileURLToPath(new URL("../../test-results/browser-results.json", import.meta.url)) }]],
  use: {
    browserName: "chromium",
    headless: true,
    viewport: { width: 900, height: 1250 },
    launchOptions: {
      ...(executablePath === undefined ? {} : { executablePath }),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
