import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

const read = (p: string) => readFileSync(p, "utf8");

describe("infrastructure security policy", () => {
  it("compose binds every port to 127.0.0.1 and pins images by digest", () => {
    const Compose = z.object({
      services: z.record(
        z.string(),
        z.object({ image: z.string(), ports: z.array(z.string()).optional() }),
      ),
    });
    const compose = Compose.parse(parse(read("docker-compose.yml")));
    for (const [name, svc] of Object.entries(compose.services)) {
      expect(svc.image, name).toMatch(/@sha256:[0-9a-f]{64}$/);
      for (const port of svc.ports ?? []) expect(port, name).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("Dockerfile uses digest-pinned bases, runs as non-root and has a healthcheck", () => {
    const df = read("Dockerfile");
    expect(df).toMatch(/ARG NODE_IMAGE=node:[^\s@]+@sha256:[0-9a-f]{64}/);
    for (const from of df.match(/^FROM .+$/gm) ?? [])
      expect(from).toMatch(/^FROM \$\{NODE_IMAGE\} AS \w+$/);
    const users = df.match(/^USER .+$/gm) ?? [];
    expect(users.at(-1)).toBe("USER node");
    expect(df).toMatch(/^HEALTHCHECK /m);
    expect(df).not.toMatch(/^(ARG|ENV) .*(KEY|SECRET|PASSWORD|TOKEN)=/im);
  });

  it(".dockerignore keeps env files and VCS data out of the build context", () => {
    const lines = read(".dockerignore")
      .split("\n")
      .map((l) => l.trim());
    for (const entry of [".env", ".env.*", ".git"]) expect(lines).toContain(entry);
  });

  it("CI pins every action by full SHA and uses a read-only token", () => {
    for (const file of readdirSync(".github/workflows")) {
      const text = read(`.github/workflows/${file}`);
      const wf = z
        .object({ permissions: z.record(z.string(), z.string()) })
        .passthrough()
        .parse(parse(text));
      expect(wf.permissions, file).toEqual({ contents: "read" });
      for (const uses of text.match(/uses:\s*\S+/g) ?? []) {
        expect(uses, file).toMatch(/@[0-9a-f]{40}$/);
      }
      expect(text, file).not.toContain("pull_request_target");
      expect(text, file).not.toMatch(/run:.*\$\{\{\s*github\.event\./);
    }
  });

  it("only the example env file is committed", () => {
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/^\.env$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
  });
});
