import { afterEach, describe, expect, it } from "vitest";
import { clearPurgeStepsForTests, registerPurgeStep, runPurge } from "@/server/jobs/purge";
import { captureLogs } from "../helpers";

afterEach(clearPurgeStepsForTests);

describe("account-management: Deleted accounts are purged", () => {
  it("Purge runs: every registered step, in order, and logs completion", async () => {
    const { lines } = captureLogs();
    const ran: string[] = [];
    registerPurgeStep("books", async (id) => void ran.push(`books:${id}`));
    registerPurgeStep("files", async (id) => void ran.push(`files:${id}`));
    expect(await runPurge({ userId: "u-1", requestId: "req-1" })).toBe(2);
    expect(ran).toEqual(["books:u-1", "files:u-1"]);
    expect(lines.filter((l) => l.event === "account.purge.step").map((l) => l.step)).toEqual([
      "books",
      "files",
    ]);
    expect(lines.find((l) => l.event === "account.purge.done")).toMatchObject({
      userId: "u-1",
      steps: 2,
    });
  });

  it("Purge step fails: the job fails (so pg-boss retries) and the failure is logged without data", async () => {
    const { lines } = captureLogs();
    registerPurgeStep("ok", async () => undefined);
    registerPurgeStep("broken", async () => {
      throw new Error("disk unavailable");
    });
    registerPurgeStep("never", async () => {
      throw new Error("must not run");
    });
    await expect(runPurge({ userId: "u-2" })).rejects.toThrow("disk unavailable");
    expect(
      lines.find((l) => l.event === "account.purge.step" && l.step === "broken"),
    ).toMatchObject({
      level: "error",
      ok: false,
      userId: "u-2",
    });
    expect(lines.some((l) => l.event === "account.purge.done")).toBe(false);
  });

  it("rejects malformed payloads and duplicate step names", async () => {
    await expect(runPurge({})).rejects.toThrow();
    registerPurgeStep("once", async () => undefined);
    expect(() => registerPurgeStep("once", async () => undefined)).toThrow(/already registered/);
  });
});
