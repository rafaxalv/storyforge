import { EnvError, getEnv, type Env } from "./env";
import { createRootLogger, loggerOptionsFrom, log, setRootLogger, type Logger } from "./log";
import { appVersion } from "@/shared/version";

export type Role = "web" | "worker" | "migrate";

const MODULE: Record<Role, string> = { web: "http", worker: "worker", migrate: "db" };

/**
 * Shared bootstrap for every entrypoint: loads and validates the environment, configures
 * the process root logger and writes the `startup` line. On invalid env it logs
 * `env.invalid` with variable names only and exits 1.
 */
export function startProcess(role: Role): Env {
  let env: Env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      // Always printed, whatever LOG_LEVEL says.
      setRootLogger(createRootLogger({ ...loggerOptionsFrom(process.env), level: "info" }));
      log("env").fatal({ event: "env.invalid", variables: err.variables }, err.message);
      process.exit(1);
    }
    throw err;
  }
  setRootLogger(createRootLogger(loggerOptionsFrom(env)));
  log(MODULE[role]).info(
    {
      event: "startup",
      role,
      version: appVersion(),
      env: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      ai: env.AI_CLIENT,
    },
    `storyforge ${role} starting`,
  );
  return env;
}

/**
 * Runs `cleanup` once on SIGTERM or SIGINT, logs `event` with the signal, then exits 0.
 * A cleanup that hangs is cut off after `timeoutMs`.
 */
export function onShutdown(
  logger: Logger,
  event: string,
  cleanup: () => Promise<void>,
  timeoutMs = 10_000,
): void {
  let stopping = false;
  const stop = (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    logger.info({ event, signal }, "shutting down");
    setTimeout(() => process.exit(0), timeoutMs).unref();
    cleanup()
      .catch((err: unknown) => logger.error({ event: `${event}.failed`, err }, "cleanup failed"))
      .finally(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
