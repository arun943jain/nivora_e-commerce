import { defineConfig, devices } from "@playwright/test";

// Dedicated ports: the suite must never attach to a dev server that is connected
// to the regular `nivora` database. Everything below starts fresh under the
// isolated `nivora_e2e_test` database.
const API_PORT = Number(process.env.E2E_API_PORT || 5055);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174);
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./.artifacts/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  globalSetup: "./global-setup.mjs",
  globalTeardown: "./global-teardown.mjs",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "./.artifacts/report", open: "never" },
    ],
  ],
  use: {
    baseURL: WEB_ORIGIN,
    headless: false,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOWMO || 120),
    },
  },
  projects: [
    {
      name: "chromium-headed",
      use: { ...devices["Desktop Chrome"], headless: false },
    },
  ],
  webServer: [
    {
      command: "node ./scripts/api-server.mjs",
      url: `${API_ORIGIN}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      cwd: "../client/Jobaaj-Store",
      url: WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `${API_ORIGIN}/api`,
      },
    },
  ],
});
