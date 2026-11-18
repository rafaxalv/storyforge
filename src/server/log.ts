import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pino, { type Logger, type LevelWithSilent } from "pino";
import pretty from "pino-pretty";
import { currentContext } from "./context";

export type { Logger };

/** Fields never written to logs (cookies, auth headers, secrets). */
export const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "headers.cookie",
  "headers.authorization",
  "*.apiKey",
  "*.password",
  "*.ANTHROPIC_API_KEY",
  "apiKey",
  "password",
];

export interface RootLoggerOptions {
  level: LevelWithSilent;
  file?: string;
  pretty?: boolean;
  /** Extra destination, used by tests to capture lines. */
  stream?: NodeJS.WritableStream;
}

export function createRootLogger(opts: RootLoggerOptions): Logger {
  const streams: pino.StreamEntry[] = [];
  if (opts.stream) {
    streams.push({ level: "trace", stream: opts.stream });
  } else {
    streams.push({
      level: "trace",
      stream: opts.pretty ? pretty({ colorize: true, sync: true }) : process.stdout,
    });
  }
  if (opts.file) {
    mkdirSync(dirname(opts.file), { recursive: true });
    streams.push({ level: "trace", stream: pino.destination({ dest: opts.file, sync: true }) });
  }
  return pino(
    {
      level: opts.level,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      formatters: { level: (label) => ({ level: label }) },
      mixin: () => {
        const ctx = currentContext();
        return ctx ? { requestId: ctx.requestId, ...(ctx.jobId ? { jobId: ctx.jobId } : {}) } : {};
      },
    },
    pino.multistream(streams),
  );
}

// One root logger per process, shared by the esbuild-bundled server and Next's bundles.
const KEY = Symbol.for("storyforge.rootLogger");
type Holder = { [KEY]?: Logger };

const LEVELS: readonly LevelWithSilent[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
  "silent",
];

function levelFromEnv(value: string | undefined): LevelWithSilent {
  return LEVELS.find((l) => l === value) ?? "info";
}

function defaultRoot(): Logger {
  const level = levelFromEnv(process.env.LOG_LEVEL);
  return createRootLogger({
    level,
    file: process.env.LOG_FILE || undefined,
    pretty: process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test",
  });
}

export function rootLogger(): Logger {
  return ((globalThis as Holder)[KEY] ??= defaultRoot());
}

/** Replaces the process root logger (startup configuration and tests). */
export function setRootLogger(logger: Logger): void {
  (globalThis as Holder)[KEY] = logger;
}

/** Named module logger: `log("health")` writes `module: "storyforge:health"`. */
export function log(name: string): Logger {
  return rootLogger().child({ module: `storyforge:${name}` });
}
