// Plain JavaScript on purpose: the production image has no TypeScript, and Next.js loads
// this file at runtime (a next.config.ts would make it try to install TypeScript).
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {(phase: string) => import("next").NextConfig} */
export default function nextConfig(phase) {
  return {
    // Dev servers write to .next-dev so they never overwrite the production build in .next
    // (which `npm run start`, the e2e tests and the image use). The dev build contains
    // eval() code that the production middleware sandbox refuses.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    poweredByHeader: false,
    reactStrictMode: true,
    // Load these from node_modules at runtime instead of bundling them (pino's transports and
    // pg's native bits don't survive bundling). Sharing one logger and request context with
    // the custom server comes from processSingleton (src/server/singleton.ts).
    serverExternalPackages: ["pino", "pino-pretty", "pg", "pg-boss"],
  };
}
