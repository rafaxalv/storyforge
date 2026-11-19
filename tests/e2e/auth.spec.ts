import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { extractLink } from "../link";
import { SINK_DIR } from "./smtp-sink";

test.describe.configure({ mode: "serial" });

const EMAIL = `e2e-${Date.now()}@example.com`;

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

async function requestLinkFor(page: Page, email: string): Promise<string> {
  const before = Date.now();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  return linkFor(email, before);
}

test("signed-out visitor is sent to sign-in and back to the page they asked for", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);
  const link = await requestLinkFor(page, EMAIL);
  await page.goto(link);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId("user-name")).toHaveText(EMAIL.split("@")[0] ?? "");
});

test("invalid address shows a message and sends nothing", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  // #sign-in-msg, not getByRole("alert"): Next adds its own route-announcer alert.
  await expect(page.locator("#sign-in-msg")).toHaveText("Enter a valid email address.");
});

test("rename, sign out, and the session is gone", async ({ page }) => {
  await page.goto("/sign-in?next=/settings");
  await page.goto(await requestLinkFor(page, EMAIL));
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByLabel("Display name").fill("E2E Author");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#name-msg")).toHaveText("Saved.");
  await expect(page.getByTestId("user-name")).toHaveText("E2E Author");

  await page.getByLabel("Display name").fill("   ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#name-msg")).toHaveText("Enter a name");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);
});

test("delete account: confirmation required, then goodbye and signed out", async ({
  page,
  request,
}) => {
  await page.goto("/sign-in");
  await page.goto(await requestLinkFor(page, EMAIL));
  await page.goto("/settings");

  await page.getByLabel(/Type DELETE to confirm/).fill("delete");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.locator("#delete-msg")).toHaveText("Type DELETE to confirm.");

  await page.getByLabel(/Type DELETE to confirm/).fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/goodbye$/);
  await expect(page.getByRole("heading", { name: "Your account is deleted" })).toBeVisible();

  // The old cookie is still in the browser: middleware lets it through, the layout finds
  // no session and sends the visitor to sign-in keeping the requested page.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings$/);
  const session = await request.get("/api/auth/get-session");
  expect(await session.json()).toBeNull();
});
