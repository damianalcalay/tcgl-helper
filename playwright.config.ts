import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
        (existsSync(systemChrome) ? systemChrome : undefined),
    },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/supabase-fixture.cjs",
      url: "http://localhost:54329/health",
      reuseExistingServer: false,
      env: { TCGL_TEST_FIXTURE: "1" },
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://localhost:3100/auth/login",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
      },
    },
  ],
});
