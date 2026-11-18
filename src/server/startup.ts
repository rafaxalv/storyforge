import { EnvError, getEnv, type Env } from "./env";
import { createRootLogger, setRootLogger, log } from "./log";
import { appVersion } from "@/shared/version";

/**
 * Validates the environment, configures the process root logger and writes the
 * `startup` line. On invalid env: logs `env.invalid` with variable names only and exits 1.
 */
export function startProcess(role: "web" | "worker"): Env {
  let env: Env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof EnvError) {
      const logger = createRootLogger({
        level: "info",
        pretty: process.env.NODE_ENV !== "production",
      });
      logger.fatal(
        { module: "storyforge:env", event: "env.invalid", variables: err.variables },
        err.message,
      );
      process.exit(1);
    }
    throw err;
  }
  setRootLogger(
    createRootLogger({
      level: env.LOG_LEVEL,
      file: env.LOG_FILE || undefined,
      pretty: env.NODE_ENV === "development",
    }),
  );
  log(role === "web" ? "http" : "worker").info(
    { event: "startup", role, version: appVersion(), env: env.NODE_ENV, logLevel: env.LOG_LEVEL },
    `storyforge ${role} starting`,
  );
  return env;
}
