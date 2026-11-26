import { expect, test } from "@playwright/test";

test.describe("Dashboard mobil", () => {
  test("hat keinen horizontalen Scroll und eine Navigation im Seitenmenü", async ({ page }) => {
    await page.goto("/analytics/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "Navigation öffnen" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("navigation", { name: "Analytics-Navigation" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
});
