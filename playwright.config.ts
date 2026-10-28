import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config. Runs against a locally running dev server unless
 * PLAYWRIGHT_BASE_URL is set (e.g. the deployed preview URL).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel:
          process.env.PLAYWRIGHT_BROWSER_CHANNEL === "msedge"
            ? "msedge"
            : process.env.PLAYWRIGHT_BROWSER_CHANNEL === "chrome"
              ? "chrome"
              : undefined,
      },
    },
  ],
});
