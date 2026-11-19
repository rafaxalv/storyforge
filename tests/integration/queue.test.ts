import { afterAll, describe, expect, it } from "vitest";
import { QUEUES } from "@/server/jobs/names";
import { closeQueue, enqueue } from "@/server/jobs/queue";
import { captureLogs, testDatabaseUrl, withDatabaseUrl, UNREACHABLE_DB_URL } from "../helpers";

afterAll(async () => {
  await closeQueue();
  await withDatabaseUrl(testDatabaseUrl());
});

describe("job queue client", () => {
  it("retries, then fails, while the database is unreachable - and recovers once it is back", async () => {
    const { lines } = captureLogs();
    await closeQueue();
    await withDatabaseUrl(UNREACHABLE_DB_URL);
    await expect(enqueue(QUEUES.accountPurge, { userId: "q-1" }, [10, 10])).rejects.toThrow();
    expect(lines.filter((l) => l.event === "jobs.enqueue.retry")).toHaveLength(2);

    // A failed start must not stay cached: with the database back, the next send works.
    await withDatabaseUrl(testDatabaseUrl());
    await expect(enqueue(QUEUES.accountPurge, { userId: "q-2" })).resolves.toMatch(/[0-9a-f-]{36}/);
  });
});
