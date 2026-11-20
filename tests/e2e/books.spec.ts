import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./sign-in";

test.describe.configure({ mode: "serial" });

const EMAIL = `books-${Date.now()}@example.com`;
let bookUrl = "";

/** Codes of the chapters listed under a part (or "Chapters with no part"), in order. */
async function codes(page: Page, list: string): Promise<string[]> {
  return page
    .getByRole("list", { name: list })
    .locator(":scope > li .chapter-code")
    .allTextContents();
}

const focusedLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");

test("create a book from the home page", async ({ page }) => {
  await signInAs(page, EMAIL);
  await expect(page.getByText("No books yet.")).toBeVisible();
  await page.getByRole("link", { name: "New book" }).click();
  await page.getByLabel("Title").fill("The Crossing");
  await page.getByRole("button", { name: "Create book" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "The Crossing" })).toBeVisible();
  await expect(page.locator("#empty-outline")).toBeVisible();
  bookUrl = new URL(page.url()).pathname;
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Books" })).toContainText("The Crossing");
});

test("signed-out visitor to a book page comes back to it after sign-in", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(bookUrl);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  // A different author: the book is not theirs, so they get "not found".
  await signInAs(page, `other-${Date.now()}@example.com`, bookUrl);
  await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
});

test("profile: fields, validation, languages, rules, labels, scheme", async ({ page }) => {
  await signInAs(page, EMAIL, `${bookUrl}/profile`);
  await expect(page).toHaveURL(new RegExp(`${bookUrl}/profile$`));

  // Fields + validation
  await page.getByLabel("One-liner").fill("Two brothers cross the sea.");
  await page.getByLabel("Length target (words)").fill("100000");
  await page.getByLabel("Hard limit (words)").fill("90000");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-msg")).toHaveText("The target can't be above the limit");
  await page.getByLabel("Length target (words)").fill("80000");
  await page.getByLabel("Hard limit (words)").fill("95000");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator("#profile-msg")).toHaveText("Saved.");

  // Languages
  const add = page.getByRole("form", { name: "Add a language" });
  await add.getByLabel("Code").fill("english");
  await add.getByLabel("Name").fill("Bad");
  await add.getByRole("button", { name: "Add language" }).click();
  await expect(page.locator("#add-lang-msg")).toContainText("Two letters");
  await add.getByLabel("Code").fill("pt-br");
  await add.getByLabel("Name").fill("Português (Brasil)");
  await add.getByRole("button", { name: "Add language" }).click();
  await expect(page.getByTestId("language-PT-BR")).toBeVisible();
  await page.getByRole("button", { name: "Move PT-BR up" }).click();
  await expect(
    page.getByRole("list", { name: "Languages" }).locator("li strong").first(),
  ).toHaveText("PT-BR");
  await page.getByRole("button", { name: "Make PT-BR the written-first language" }).click();
  await expect(page.getByTestId("language-PT-BR")).toContainText("written first");
  await page.getByRole("button", { name: "Make EN the written-first language" }).click();
  await expect(page.getByTestId("language-EN")).toContainText("written first");

  // Standing rules
  await page.getByText("Add a rule").click();
  const newRule = page.getByRole("textbox", { name: "New rule" });
  await newRule.click();
  await page.keyboard.type("No anachronisms");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByTestId("rule")).toHaveCount(1);
  await page.getByRole("textbox", { name: "New rule" }).click();
  await page.keyboard.type("Dates in full");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByTestId("rule")).toHaveCount(2);
  await page.getByRole("button", { name: "Move rule 2 up" }).click();
  await expect(page.getByTestId("rule").first()).toContainText("Dates in full");
  await expect(page.getByTestId("rule").first().locator("time")).toHaveText(/^\d{4}-\d{2}-\d{2}$/);

  // Truth labels
  await page.getByRole("button", { name: "Add label" }).click();
  await page.getByLabel("Label 6").fill("RUMOUR");
  await page.getByRole("button", { name: "Move RUMOUR up" }).click();
  await page.getByRole("button", { name: "Save labels" }).click();
  await expect(page.locator("#labels-msg")).toHaveText("Saved.");
  await page.reload();
  await expect(page.getByLabel("Label 5")).toHaveValue("RUMOUR");
  await page.getByRole("button", { name: "Reset to cowriter defaults" }).click();
  await expect(page.getByLabel("Label 5")).toHaveValue("FICTIONAL");

  // Scheme
  await expect(page.getByTestId("scheme-examples")).toContainText("03.014a");
});

test("outline: parts, chapters, codes, keyboard reorder, remove and restore", async ({ page }) => {
  await signInAs(page, EMAIL, bookUrl);
  const addPart = page.getByRole("form", { name: "Add a part" });
  await addPart.getByLabel("Title (EN)").fill("Book One");
  await addPart.getByRole("button", { name: "Add part" }).click();
  await expect(page.getByRole("heading", { level: 3, name: /Book One/ })).toBeVisible();

  const addChapter = page.getByRole("form", { name: "Add a chapter" });
  for (const [code, title] of [
    ["01", "Arrival"],
    ["02", "Harbour"],
    ["03", "Storm"],
  ]) {
    await expect(addChapter.getByLabel("Code")).toHaveValue(code ?? "");
    await addChapter.getByLabel("Title (EN)").fill(title ?? "");
    await addChapter.getByRole("button", { name: "Add chapter" }).click();
    await expect(page.getByTestId(`chapter-${code}`)).toBeVisible();
  }
  // Invalid and duplicate codes
  await addChapter.getByLabel("Code").fill("02");
  await addChapter.getByLabel("Title (EN)").fill("Again");
  await addChapter.getByRole("button", { name: "Add chapter" }).click();
  await expect(page.locator("#new-chapter-msg")).toContainText("already used");

  const list = "Chapters of Book One";
  expect(await codes(page, list)).toEqual(["01", "02", "03"]);

  // Keyboard only: focus the move button, press Enter twice.
  await page.getByRole("button", { name: "Move chapter 03 up" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => codes(page, list)).toEqual(["01", "03", "02"]);
  expect(await focusedLabel(page)).toContain("chapter 03");
  await page.keyboard.press("Enter");
  await expect.poll(() => codes(page, list)).toEqual(["03", "01", "02"]);
  await expect.poll(() => focusedLabel(page)).toContain("chapter 03");
  await expect(page.getByRole("button", { name: "Move chapter 03 up" })).toBeDisabled();

  // Remove and restore
  await page.getByRole("button", { name: "Remove chapter 03" }).click();
  await expect.poll(() => codes(page, list)).toEqual(["01", "02"]);
  await page.getByText(/^Removed \(1\)$/).click();
  await page.getByRole("button", { name: "Restore chapter 03" }).click();
  await expect.poll(() => codes(page, list)).toEqual(["01", "02", "03"]);

  // A part with chapters can't be removed
  await page.getByRole("button", { name: "Remove part Book One" }).click();
  await expect(page.getByText("Move or remove this part's chapters first.")).toBeVisible();
});

test("Concept: autosave, reload, and the side panel beside the outline", async ({ page }) => {
  await signInAs(page, EMAIL, `${bookUrl}/concept`);
  const editor = page.getByRole("textbox", { name: "Concept" });
  await editor.click();
  await page.keyboard.type("A crossing in 1912.");
  await expect(page.locator("#concept-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Concept" })).toContainText("A crossing in 1912.");

  await page.getByRole("link", { name: "Outline" }).click();
  await page.getByRole("link", { name: "Open Concept beside" }).click();
  await expect(page).toHaveURL(/panel=concept/);
  const panel = page.locator("#concept-panel");
  await expect(panel.getByRole("textbox", { name: "Concept" })).toContainText(
    "A crossing in 1912.",
  );
  await expect(page.getByTestId("chapter-01")).toBeVisible();
  await panel.getByRole("textbox", { name: "Concept" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Two brothers.");
  await expect(page.locator("#panel-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await expect(page.locator("#concept-panel")).toBeVisible();
  await page.goto(`${bookUrl}/concept`);
  await expect(page.getByRole("textbox", { name: "Concept" })).toContainText("Two brothers.");
});

test("Concept: a stale tab is told to reload and keeps its text", async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage();
  await signInAs(a, EMAIL, `${bookUrl}/concept`);
  const b = await context.newPage();
  await b.goto(`${bookUrl}/concept`);
  await expect(b.getByRole("textbox", { name: "Concept" })).toBeVisible();

  await a.getByRole("textbox", { name: "Concept" }).click();
  await a.keyboard.type(" From A.");
  await expect(a.locator("#concept-status")).toHaveText("Saved", { timeout: 10_000 });

  await b.getByRole("textbox", { name: "Concept" }).click();
  await b.keyboard.type(" From B.");
  await expect(b.locator("#concept-status")).toContainText("Changed elsewhere", {
    timeout: 10_000,
  });
  await expect(b.getByRole("textbox", { name: "Concept" })).toContainText("From B.");
  await expect(b.getByRole("button", { name: "Copy my text" })).toBeVisible();

  await a.reload();
  await expect(a.getByRole("textbox", { name: "Concept" })).toContainText("From A.");
  await expect(a.getByRole("textbox", { name: "Concept" })).not.toContainText("From B.");
});

test("delete the book with its typed title", async ({ page }) => {
  await signInAs(page, EMAIL, `${bookUrl}/profile`);
  await page.getByLabel(/Type the title/).fill("the crossing");
  await page.getByRole("button", { name: "Delete this book" }).click();
  await expect(page.locator("#delete-book-msg")).toContainText("exactly");
  await page.getByLabel(/Type the title/).fill("The Crossing");
  await page.getByRole("button", { name: "Delete this book" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("No books yet.")).toBeVisible();
});
