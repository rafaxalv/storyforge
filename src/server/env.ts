import { createRequire } from "node:module";
import { z } from "zod";

// @next/env is a CommonJS bundle: Node's ESM loader can't see its named exports and
// bundlers disagree on its default export, so it is loaded with require everywhere.
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    LOG_FILE: z.string().default(""),
    AI_CLIENT: z.enum(["fake", "anthropic"]).default("fake"),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AI_CLIENT === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "required when AI_CLIENT=anthropic",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  constructor(public readonly variables: string[]) {
    super(`Invalid or missing environment variables: ${variables.join(", ")}`);
    this.name = "EnvError";
  }
}

/**
 * Parses an environment object. Throws EnvError listing the variable NAMES that are
 * missing or invalid - never their values, which may be secrets.
 */
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  // Empty strings count as unset, so `ANTHROPIC_API_KEY=` in .env behaves like no key.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0] ?? "?")))];
    throw new EnvError(names.sort());
  }
  return result.data;
}

const quiet = { info: () => undefined, error: () => undefined };
let loaded = false;

/**
 * Loads `.env*` files into process.env exactly as Next.js does (`.env`, `.env.local`,
 * `.env.<mode>`, ...; variables already set in the process win). Every entrypoint, test
 * helper and the Playwright config use this, so they all see the same configuration as
 * the Next.js app. In the Docker image there are no .env files, only the process env.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", quiet);
}

let cached: Env | undefined;

/** Loads `.env*` files once and validates process.env once. */
export function getEnv(): Env {
  if (cached) return cached;
  loadEnv();
  cached = parseEnv(process.env);
  return cached;
}
