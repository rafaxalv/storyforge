import { registerPurgeStep } from "../jobs/purge";
import { purgeBooks } from "./books";

/** Registers the books purge step once per process (the worker imports this). */
export function registerBooksPurge(): void {
  registerPurgeStep("books", async (userId) => {
    await purgeBooks(userId);
  });
}
