import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Logging, database and queue libraries run in Node as-is (not bundled), so the
  // custom server and the route handlers share one logger and one request context.
  serverExternalPackages: ["pino", "pino-pretty", "pg", "pg-boss"],
  env: { STORYFORGE_BUILD_VERSION: pkg.version },
};

export default nextConfig;
