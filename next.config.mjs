// Plain JavaScript on purpose: the production image has no TypeScript, and Next.js loads
// this file at runtime (a next.config.ts would make it try to install TypeScript).
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Logging, database and queue libraries run in Node as-is (not bundled), so the
  // custom server and the route handlers share one logger and one request context.
  serverExternalPackages: ["pino", "pino-pretty", "pg", "pg-boss"],
  env: { STORYFORGE_BUILD_VERSION: String(pkg.version) },
};

export default nextConfig;
