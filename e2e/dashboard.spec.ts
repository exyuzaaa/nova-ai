import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const DASHBOARD = "/analytics/demo";

const kpiButtons = (page: Page) => page.locator("button[aria-pressed]");

test.describe("Dashboard (Demo-Website)", () => {
  test("kennzeichnet Demo-Daten dauerhaft", async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("note", { name: "Hinweis zu Demo-Daten" })).toContainText("Demo-Daten");
    await expect(kpiButtons(page)).toHaveCount(9);
  });

  test("zeigt alle Kennzahlen und Bereiche des Briefings", async ({ page }) => {
    await page.goto(DASHBOARD);
    for (const label of [
      "Eindeutige Besucher",
      "Sessions",
      "Seitenaufrufe",
      "Neue Besucher",
      "Wiederkehrende Besucher",
      "Ø Sitzungsdauer",
      "Absprungrate",
      "Conversion Rate",
      "Generierte Leads",
    ]) {
      // Leerzeichen können geschützt sein (z. B. „Ø\u00a0Sitzungsdauer“).
      await expect(page.getByRole("button", { name: new RegExp(`^${label.replace(/ /g, "\\s")}$`) })).toBeVisible();
    }
    for (const heading of [
      "Neue vs. wiederkehrende Besucher",
      "Conversion-Entwicklung",
      "Traffic nach Quelle",
      "Beliebteste Seiten",
      "Top-Länder",
      "Geräteverteilung",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("wechselt das Hauptdiagramm per Klick auf eine Kennzahl", async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByRole("heading", { name: "Eindeutige Besucher im Verlauf" })).toBeVisible();
    const bounce = page.getByRole("button", { name: "Absprungrate", exact: true });
    await bounce.click();
    await expect(bounce).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Absprungrate im Verlauf" })).toBeVisible();
  });

  test("filtert nach Zeitraum und Vergleich über die URL", async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.getByRole("button", { name: /^Zeitraum:/ }).click();
    await page.getByRole("menuitemradio", { name: "Letzte 7 Tage" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(page.getByRole("button", { name: "Zeitraum: Letzte 7 Tage" })).toBeVisible();

    await page.getByRole("button", { name: /^Vergleich:/ }).click();
    await page.getByRole("menuitemradio", { name: "Kein Vergleich" }).click();
    await expect(page).toHaveURL(/compare=none/);
    await expect(page.getByText("vs. Vorperiode")).toHaveCount(0);
    await expect(page.getByText(/verglichen mit/)).toHaveCount(0);
  });

  test("ignoriert manipulierte Filterwerte", async ({ page }) => {
    await page.goto(`${DASHBOARD}?range=%3Cscript%3E&compare=x`);
    await expect(page.getByRole("button", { name: "Zeitraum: Letzte 28 Tage" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vergleich: Vorheriger Zeitraum" })).toBeVisible();
  });

  test("bietet jede Zeitreihe auch als Tabelle an", async ({ page }) => {
    await page.goto(`${DASHBOARD}?range=28d&compare=previous`);
    const mainChart = page.locator("section", { has: page.getByRole("heading", { name: "Eindeutige Besucher im Verlauf" }) });
    await mainChart.getByRole("radio", { name: "Tabelle" }).click();
    const table = mainChart.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(28);
    await expect(table.getByRole("columnheader", { name: "Vergleich" })).toBeVisible();
  });

  test("zeigt für unbekannte Websites eine Fehlerseite", async ({ page }) => {
    await page.goto("/analytics/gibt-es-nicht");
    await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  });

  test("hat einen Sprunglink zum Inhalt", async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Zum Inhalt springen" })).toBeFocused();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`hat keine Barrierefreiheitsverstöße (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto(DASHBOARD);
      await expect(kpiButtons(page)).toHaveCount(9);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme === "dark" ? "dark" : "light"));
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}× ${violation.help}`);
      expect(summary).toEqual([]);
    });
  }

  test("zeigt die Besucheranalyse mit Demo-Daten, aber keine Echtzeit", async ({ page }) => {
    await page.goto(DASHBOARD);
    await expect(page.getByRole("link", { name: "Echtzeit" })).toHaveCount(0);
    await page.getByRole("link", { name: "Besucher" }).first().click();
    await expect(page.getByRole("heading", { name: "Besucher", level: 1 })).toBeVisible();
    await expect(page.getByRole("note", { name: "Hinweis zu Demo-Daten" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Sitzungsdauer" }).getByRole("table")).toContainText("unter 10 Sek.");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });

  test("schaltet zwischen hellem und dunklem Design um", async ({ page }) => {
    await page.goto(DASHBOARD);
    await page.getByRole("radio", { name: "Dunkel" }).first().click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("radio", { name: "Hell" }).first().click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
