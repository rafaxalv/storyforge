import { expect, test } from "@playwright/test";

test("a signed-out visit to / ends on the sign-in page, with a request id", async ({ page }) => {
  const response = await page.goto("/");
  expect(page.url()).toMatch(/\/sign-in$/);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Sign in to storyforge" })).toBeVisible();
});

test("health endpoint reports the database as ok", async ({ request }) => {
  const res = await request.get("/api/health", { headers: { "x-request-id": "e2e-health-1" } });
  expect(res.status()).toBe(200);
  expect(res.headers()["x-request-id"]).toBe("e2e-health-1");
  expect(await res.json()).toEqual({ version: expect.any(String), db: "ok" });
});
