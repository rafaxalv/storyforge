// Plain JavaScript on purpose: the production image has no TypeScript, and Next.js loads
// this file at runtime (a next.config.ts would make it try to install TypeScript).

/** @type {import("next").NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Load these from node_modules at runtime instead of bundling them (pino's transports and
  // pg's native bits don't survive bundling). Sharing one logger and request context with
  // the custom server comes from processSingleton (src/server/singleton.ts).
  serverExternalPackages: ["pino", "pino-pretty", "pg", "pg-boss"],
};

export default nextConfig;
