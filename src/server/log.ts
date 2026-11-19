import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pino, { type Logger, type LevelWithSilent } from "pino";
import pretty from "pino-pretty";
import { currentContext } from "./context";
import { LOG_LEVELS } from "./env";
import { processSingleton, setProcessSingleton } from "./singleton";

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
  const main =
    opts.stream ?? (opts.pretty ? pretty({ colorize: true, sync: true }) : process.stdout);
  const streams: pino.StreamEntry[] = [{ level: "trace", stream: main }];
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

/**
 * The one place that turns settings into logger options: level from LOG_LEVEL (default
 * info), file from LOG_FILE, coloured output only in development (JSON otherwise).
 */
export function loggerOptionsFrom(src: {
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  LOG_FILE?: string;
}): RootLoggerOptions {
  return {
    level: LOG_LEVELS.find((l) => l === src.LOG_LEVEL) ?? "info",
    file: src.LOG_FILE || undefined,
    pretty: (src.NODE_ENV ?? "development") === "development",
  };
}

/** Used until startProcess() installs the configured root logger (and in tests). */
function defaultRoot(): Logger {
  return createRootLogger(loggerOptionsFrom(process.env));
}

/** One root logger per process, shared by the custom server and Next's bundles. */
export function rootLogger(): Logger {
  return processSingleton("rootLogger", defaultRoot);
}

/** Replaces the process root logger (startup configuration and tests). */
export function setRootLogger(logger: Logger): void {
  setProcessSingleton("rootLogger", logger);
}

/** Named module logger: `log("health")` writes `module: "storyforge:health"`. */
export function log(name: string): Logger {
  return rootLogger().child({ module: `storyforge:${name}` });
}
