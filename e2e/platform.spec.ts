import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const expectAccessible = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`),
  ).toEqual([]);
};

test.describe("NOVA-Plattform: Verwaltung eines Unternehmens", () => {
  let page: Page;
  let base = "";

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await signUpAndConfirm(page, uniqueEmail("platform-owner"));
    await page.getByLabel("Name des Unternehmens").fill("Werkstatt Süd");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/werkstatt-sued(-[a-f0-9]{6})?$/);
    base = new URL(page.url()).pathname;
  });

  test("Übersicht zeigt Unternehmen, Module und Hinweis auf das Profil", async () => {
    await expect(page.getByRole("heading", { name: "Werkstatt Süd", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Deine Module" })).toContainText("Analytics");
    await expect(page.getByRole("link", { name: /Vervollständige das Unternehmensprofil/ })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).first();
    for (const label of ["Übersicht", "Analytics", "Unternehmen", "Mitglieder", "Rollen und Rechte", "Abteilungen und Teams", "Module", "Protokoll"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expectAccessible(page);
  });

  test("Unternehmensprofil wird geprüft und gespeichert", async () => {
    await page.goto(`${base}/verwaltung`);
    await page.getByLabel("Firmierung (laut Handelsregister)").fill("Werkstatt Süd GmbH");
    await page.getByLabel("Straße und Hausnummer").fill("Hauptstraße 1");
    await page.getByLabel("Postleitzahl").fill("80331");
    await page.getByLabel("Ort").fill("München");
    await page.getByLabel("USt-IdNr.").fill("DE12");
    await page.getByRole("button", { name: "Profil speichern" }).click();
    await expect(page.getByText("Bitte gib eine gültige USt-IdNr. ein")).toBeVisible();

    await page.getByLabel("USt-IdNr.").fill("DE 123 456 789");
    await page.getByLabel("Unternehmensgröße").selectOption("11-50");
    await page.getByRole("button", { name: "Profil speichern" }).click();
    await expect(page.getByText("Unternehmensprofil gespeichert.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("USt-IdNr.")).toHaveValue("DE123456789");
    await expect(page.getByLabel("Ort")).toHaveValue("München");
    await expectAccessible(page);
  });

  test("Abteilungen, Unterabteilungen und Teams", async () => {
    await page.goto(`${base}/verwaltung/abteilungen`);
    const newDepartment = page.locator("div", { has: page.getByRole("heading", { name: "Neue Abteilung" }) }).last();
    await newDepartment.getByLabel("Name").fill("Vertrieb");
    await newDepartment.getByRole("button", { name: "Abteilung anlegen" }).click();
    await expect(page.getByText("Abteilung „Vertrieb“ angelegt.")).toBeVisible();

    await newDepartment.getByLabel("Name").fill("Innendienst");
    await newDepartment.getByLabel("Übergeordnete Abteilung").selectOption({ label: "Vertrieb" });
    await newDepartment.getByRole("button", { name: "Abteilung anlegen" }).click();
    await expect(page.getByText("Abteilung „Innendienst“ angelegt.")).toBeVisible();

    await newDepartment.getByLabel("Name").fill("vertrieb");
    await newDepartment.getByRole("button", { name: "Abteilung anlegen" }).click();
    await expect(page.getByText("Dieser Name ist bereits vergeben.")).toBeVisible();

    const newTeam = page.locator("div", { has: page.getByRole("heading", { name: "Neues Team" }) }).last();
    await newTeam.getByLabel("Name").fill("Team Nord");
    await newTeam.getByLabel("Abteilung").selectOption({ label: "Vertrieb" });
    await newTeam.getByRole("button", { name: "Team anlegen" }).click();
    await expect(page.getByText("Team „Team Nord“ angelegt.")).toBeVisible();

    const team = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Team Nord" }) });
    await team.getByRole("checkbox").first().check();
    await team.getByRole("button", { name: "Mitglieder von Team Nord speichern" }).click();
    await expect(page.getByText("Teammitglieder gespeichert.")).toBeVisible();
    await expect(team).toContainText("1 Mitglied");
    await expectAccessible(page);
  });

  test("Globale Suche findet nur Erlaubtes und ist per Tastatur erreichbar", async () => {
    await page.goto(base);
    const box = page.getByRole("searchbox", { name: "Suchen" }).first();
    await expect(box).toBeVisible();
    // Das Tastenkürzel greift, sobald die Seite interaktiv ist
    await expect(async () => {
      await page.locator("main").click({ position: { x: 5, y: 5 } });
      await page.keyboard.press("/");
      await expect(box).toBeFocused({ timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await box.fill("vertr");
    await box.press("Enter");
    await expect(page).toHaveURL(`${base}/suche?q=vertr`);
    const departments = page.getByRole("region", { name: "Abteilungen" });
    await expect(departments.getByRole("link", { name: "Vertrieb" })).toBeVisible();
    await page.goto(`${base}/suche?q=gibtesnicht`);
    await expect(page.getByText("Keine Treffer für „gibtesnicht“.")).toBeVisible();
    await expectAccessible(page);
  });

  test("Eigene Rolle mit zusätzlichem Recht", async () => {
    await page.goto(`${base}/verwaltung/rollen`);
    await expect(page.getByRole("table", { name: "Rechte je Basisrolle" })).toBeVisible();
    const form = page.getByRole("region", { name: "Neue Rolle" });
    await form.getByLabel("Name der Rolle").fill("Teamleitung");
    await form.getByRole("checkbox", { name: /Abteilungen und Teams verwalten/ }).check();
    await form.getByRole("button", { name: "Rolle anlegen" }).click();
    await expect(page.getByText("Rolle „Teamleitung“ angelegt.")).toBeVisible();
    // Verwaltungsrechte des Kerns tauchen gar nicht erst als vergebbar auf
    await expect(form.getByRole("checkbox", { name: /Mitglieder verwalten/ })).toHaveCount(0);
    await expectAccessible(page);

    await page.goto(`${base}/verwaltung/mitglieder`);
    const extra = page.getByRole("region", { name: "Zusätzliche Rollen" });
    await extra.getByRole("checkbox", { name: "Teamleitung" }).check();
    await extra.getByRole("button", { name: /Rollen von .* speichern/ }).click();
    await expect(extra.getByText("Rollen gespeichert.")).toBeVisible();
  });

  test("Modul ausschalten sperrt den Bereich, Einschalten gibt ihn frei", async () => {
    await page.goto(`${base}/verwaltung/module`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Analytics ausschalten" }).click();
    await expect(page.getByRole("button", { name: "Analytics einschalten" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).first();
    await expect(nav.getByRole("link", { name: "Analytics", exact: true })).toHaveCount(0);
    await page.goto(`${base}/analytics`);
    await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();

    await page.goto(`${base}/verwaltung/module`);
    await page.getByRole("button", { name: "Analytics einschalten" }).click();
    await expect(page.getByRole("button", { name: "Analytics ausschalten" })).toBeVisible();
    await expect(page.getByRole("region", { name: "In Entwicklung" })).toContainText("CRM");
    await expectAccessible(page);
  });

  test("Protokoll zeigt alle Änderungen", async () => {
    await page.goto(`${base}/verwaltung/protokoll`);
    const log = page.getByRole("table");
    for (const text of [
      "Unternehmen „Werkstatt Süd“ angelegt",
      "Abteilung „Vertrieb“ angelegt",
      "Team „Team Nord“ angelegt",
      "Rolle „Teamleitung“ angelegt",
      "Rolle an ein Mitglied vergeben",
      "Modul analytics ausgeschaltet",
      "Modul analytics eingeschaltet",
    ]) {
      await expect(log.getByText(text).first()).toBeVisible();
    }
    await expectAccessible(page);
  });

  test("Mobil: Navigation über das Menü, kein horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Navigation öffnen" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Abteilungen und Teams" }).click();
    await expect(page).toHaveURL(`${base}/verwaltung/abteilungen`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
