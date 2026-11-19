import { existsSync } from "node:fs";
import { z } from "zod";

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    LOG_FILE: z.string().default(""),
    APP_VERSION: z.string().optional(),
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

let cached: Env | undefined;

/** Loads `.env` (outside production, when present) and validates process.env once. */
export function getEnv(): Env {
  if (cached) return cached;
  if (process.env.NODE_ENV !== "production" && existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  cached = parseEnv(process.env);
  return cached;
}
