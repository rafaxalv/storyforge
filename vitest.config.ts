import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "./src/server/env";

// DATABASE_URL_TEST comes from .env locally and from the workflow in CI.
loadEnv();

const shared = {
  NODE_ENV: "test" as const,
  AI_CLIENT: "fake",
  LOG_LEVEL: "silent",
  LOG_FILE: "",
  // Test-only values; never used outside the test run.
  BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef0123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
  ADMIN_EMAILS: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  EMAIL_TRANSPORT: "outbox",
  MAIL_OUTBOX_DIR: join(tmpdir(), `storyforge-outbox-${process.pid}`),
};

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          // Unit tests never reach a database: anything that tries fails fast.
          env: { ...shared, DATABASE_URL: "postgres://nobody:nothing@127.0.0.1:1/none" },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          env: { ...shared, DATABASE_URL: process.env.DATABASE_URL_TEST ?? "" },
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
