import { defineConfig, devices } from "@playwright/test";

// Overridable for local runs where port 3000 is already held by an
// unrelated process; CI and the documented default both stay on 3000.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const workers = process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : 1;

export default defineConfig({
  testDir: ".",
  testMatch: ["tests/e2e/**/*.spec.ts", "e2e/**/*.spec.ts"],
  fullyParallel: true,
  timeout: 120_000,
  workers,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
