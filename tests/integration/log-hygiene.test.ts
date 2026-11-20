import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteAccount, updateDisplayName } from "@/server/account/account";
import { getActor } from "@/server/auth/actor";
import { getEnv } from "@/server/env";
import { closeQueue } from "@/server/jobs/queue";
import { captureLogs } from "../helpers";
import { clearOutbox, latestLink, resetAuthTables, signIn } from "./auth-helpers";

beforeAll(async () => {
  await resetAuthTables();
  await clearOutbox();
});
afterAll(closeQueue);

describe("log hygiene across sign-in, rename and deletion", () => {
  it("never logs the email address, the link token, the session token or the secret", async () => {
    const { lines } = captureLogs("trace");
    const email = "private.person@example.com";
    const { cookie, headers } = await signIn(email);
    const token = new URL(await latestLink(email)).searchParams.get("token") ?? "";
    const sessionToken = cookie.match(/session_token=([^;.]+)/)?.[1] ?? "";
    const me = await getActor(headers);
    await updateDisplayName(me, me.userId, "Private Person");
    await deleteAccount(headers, "DELETE");

    const all = JSON.stringify(lines);
    expect(lines.length).toBeGreaterThan(5);
    expect(token.length).toBeGreaterThan(10);
    expect(sessionToken.length).toBeGreaterThan(10);
    for (const secret of [
      email,
      "private.person",
      token,
      sessionToken,
      getEnv().BETTER_AUTH_SECRET,
    ]) {
      expect(all).not.toContain(secret);
    }
  });
});

describe("book-profile: Logs carry ids only", () => {
  it("never logs titles, one-liners, notes, rule, Concept, part or chapter text", async () => {
    const { makeAuthor } = await import("./book-helpers");
    const { createBook, updateProfile, updateTruthLabels, deleteBook } =
      await import("@/server/books/books");
    const { addLanguage, renameLanguage } = await import("@/server/books/languages");
    const { addRule } = await import("@/server/books/rules");
    const { saveConcept } = await import("@/server/books/concept");
    const { createPart, createChapter, renameChapter } = await import("@/server/books/structure");
    const { lines } = captureLogs("trace");
    const s = (field: string) => `SENTINEL-${field}-7f3a`;
    const doc = (text: string) => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });

    const author = await makeAuthor();
    const { id } = await createBook(author, {
      title: s("title"),
      languageCode: "EN",
      languageName: s("langname"),
    });
    await updateProfile(
      author,
      id,
      {
        title: s("title2"),
        oneLiner: s("oneliner"),
        lengthTarget: "",
        lengthLimit: "",
        peopleNotes: s("notes"),
      },
      1,
    );
    await updateTruthLabels(author, id, [s("label")], 2);
    const { id: fr } = await addLanguage(author, id, { code: "FR", name: s("fr") });
    await renameLanguage(author, id, fr, s("fr2"));
    await addRule(author, id, doc(s("rule")));
    await saveConcept(author, id, doc(s("concept")), 1);
    const { id: part } = await createPart(author, id, { EN: s("part") });
    const { id: ch } = await createChapter(author, id, {
      code: "01",
      titles: { EN: s("chapter") },
      partId: part,
    });
    await renameChapter(author, id, ch, { EN: s("chapter2"), FR: s("chapterfr") });
    await deleteBook(author, id, "wrong").catch(() => undefined);
    await deleteBook(author, id, s("title2"));

    const all = JSON.stringify(lines);
    expect(
      lines.filter((l) => String(l.event).match(/^(book|concept|part|chapter)\./)).length,
    ).toBeGreaterThan(8);
    expect(all).not.toContain("SENTINEL");
  });
});
