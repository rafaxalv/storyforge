import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { extractLink } from "../link";
import { SINK_DIR } from "./smtp-sink";

/** The newest sign-in link to `to` that arrived after `after` (ms), if any. */
async function findLink(to: string, after: number): Promise<string | undefined> {
  for (const f of (await readdir(SINK_DIR)).sort().reverse()) {
    if (Number(f.split("-")[0]) < after) continue;
    const m = JSON.parse(await readFile(join(SINK_DIR, f), "utf8")) as {
      to?: string;
      text?: string;
    };
    const link = extractLink(m.text);
    if (m.to === to && link) return link;
  }
  return undefined;
}

/** Waits (Playwright's polling) for the sign-in email to `to` in the SMTP sink. */
async function linkFor(to: string, after: number): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(async () => (link = await findLink(to, after)), {
      message: `sign-in email for ${to}`,
      timeout: 5_000,
    })
    .toBeTruthy();
  return link ?? "";
}

export async function requestLinkFor(page: Page, email: string): Promise<string> {
  await asNewClient(page);
  const before = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  return linkFor(email, before);
}

/** Signs a new author in through the sign-in page; lands on `next` (default home). */
export async function signInAs(page: Page, email: string, next = "/"): Promise<void> {
  await page.goto(next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`);
  await page.goto(await requestLinkFor(page, email));
}

/** Gives this browser context its own client address for the server's rate limits. */
export async function asNewClient(page: Page): Promise<void> {
  const ip = `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join(".")}`;
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": ip });
}
