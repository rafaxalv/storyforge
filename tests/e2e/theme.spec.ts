import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./sign-in";

/** WCAG contrast ratio between the body text colour and the page background. */
async function bodyContrast(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rgb = (c: string) => (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const lum = (c: string) => {
      const [r, g, b] = rgb(c).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const style = getComputedStyle(document.body);
    const [a, b] = [lum(style.color), lum(style.backgroundColor)].sort((x, y) => y - x);
    return ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`text is readable in ${colorScheme} mode`, async ({ browser }) => {
    const page = await (await browser.newContext({ colorScheme })).newPage();
    await page.goto("/sign-in");
    expect(await bodyContrast(page)).toBeGreaterThanOrEqual(4.5);
    await signInAs(page, `theme-${colorScheme}-${Date.now()}@example.com`);
    for (const path of ["/", "/settings", "/books/new"]) {
      await page.goto(path);
      expect(await bodyContrast(page), path).toBeGreaterThanOrEqual(4.5);
    }
  });
}
