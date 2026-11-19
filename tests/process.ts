import { spawn, type ChildProcess } from "node:child_process";

export interface Spawned {
  child: ChildProcess;
  lines: Record<string, unknown>[];
  /** Resolves with the first JSON line matching `event`, rejects after `timeoutMs`. */
  waitFor(event: string, timeoutMs?: number): Promise<Record<string, unknown>>;
  exit: Promise<number | null>;
}

/**
 * Runs a TypeScript entrypoint with tsx as NODE_ENV=test (JSON log lines on stdout), with
 * the test run's auth and email settings and only the variables given in `env` besides.
 */
export function spawnTs(entry: string, env: Record<string, string>): Spawned {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "test",
      LOG_LEVEL: "info",
      LOG_FILE: "",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
      EMAIL_TRANSPORT: process.env.EMAIL_TRANSPORT ?? "outbox",
      MAIL_OUTBOX_DIR: process.env.MAIL_OUTBOX_DIR ?? "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines: Record<string, unknown>[] = [];
  const waiters: { event: string; resolve: (l: Record<string, unknown>) => void }[] = [];
  let buffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const raw of parts) {
      if (!raw.trim().startsWith("{")) continue;
      const line = JSON.parse(raw) as Record<string, unknown>;
      lines.push(line);
      for (const w of waiters.filter((w) => w.event === line.event)) w.resolve(line);
    }
  });
  const exit = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  return {
    child,
    lines,
    exit,
    waitFor(event, timeoutMs = 20_000) {
      const found = lines.find((l) => l.event === event);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                `timed out waiting for ${event}; saw ${lines.map((l) => l.event).join(", ")}`,
              ),
            ),
          timeoutMs,
        );
        waiters.push({ event, resolve: (l) => (clearTimeout(timer), resolve(l)) });
      });
    },
  };
}
