import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./src/server/env";
import { SMTP_PORT } from "./tests/e2e/smtp-sink";

// Locally the test database URL comes from the .env files; in CI it is set in the workflow.
loadEnv();

const PORT = 3200;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/smtp-sink.ts",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Runs the production build (npm run build must have run first).
    command: "node dist/main.js",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      AI_CLIENT: "fake",
      LOG_LEVEL: "info",
      LOG_FILE: "",
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "",
      // Test-only values. Emails go to the local SMTP sink started in globalSetup.
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdef0123456789",
      BETTER_AUTH_URL: BASE_URL,
      ADMIN_EMAILS: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      EMAIL_TRANSPORT: "smtp",
      SMTP_URL: `smtp://127.0.0.1:${SMTP_PORT}`,
      MAIL_FROM: "storyforge <no-reply@example.com>",
    },
  },
});
