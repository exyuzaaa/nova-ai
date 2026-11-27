import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
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

const newTenant = async (browser: Browser, prefix: string, company: string) => {
  const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
  await signUpAndConfirm(page, uniqueEmail(prefix));
  await page.getByLabel("Name des Unternehmens").fill(company);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
  return { page, base: new URL(page.url()).pathname };
};

test.describe("CRM: Kunden, Ansprechpartner, Aktivitäten", () => {
  let page: Page;
  let base = "";
  let customerUrl = "";

  test.beforeAll(async ({ browser }) => {
    ({ page, base } = await newTenant(browser, "crm-owner", "Vertriebsbüro Ost"));
  });

  test("CRM ist in der Navigation und zeigt eine leere Übersicht", async () => {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: "CRM", exact: true }).click();
    await expect(page).toHaveURL(`${base}/crm`);
    await expect(page.getByRole("heading", { name: "CRM", level: 1 })).toBeVisible();
    await expect(page.getByText("Noch keine Kunden")).toBeVisible();
    await expectAccessible(page);
  });

  test("Kunde anlegen, Pflichtfelder werden geprüft", async () => {
    await page.getByRole("link", { name: "Neuer Kunde" }).click();
    await expect(page).toHaveURL(`${base}/crm/kunden/neu`);
    await page.getByLabel("E-Mail-Adresse").fill("keine-mail");
    await page.getByRole("button", { name: "Kunde anlegen" }).click();
    await expect(page.getByText("Bitte gib einen Namen ein.")).toBeVisible();
    await expect(page.getByText("Bitte gib eine gültige E-Mail-Adresse ein.")).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill("Müller Maschinenbau GmbH");
    await page.getByLabel("E-Mail-Adresse").fill("info@mueller-mb.example");
    await page.getByLabel("Ort").fill("Augsburg");
    await page.getByLabel("Schlagwörter").fill("B2B, Maschinenbau");
    await page.getByRole("button", { name: "Kunde anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Müller Maschinenbau GmbH", level: 1 })).toBeVisible();
    await expect(page.getByText("K-00001")).toBeVisible();
    customerUrl = new URL(page.url()).pathname;
    await expectAccessible(page);
  });

  test("Dublettenwarnung bei ähnlichem Namen, Anlegen nach Bestätigung", async () => {
    await page.goto(`${base}/crm/kunden/neu`);
    await page.getByLabel("Name", { exact: true }).fill("Mueller Maschinenbau GmbH");
    await page.getByRole("button", { name: "Kunde anlegen" }).click();
    const duplicates = page.getByRole("group", { name: "Mögliche Dubletten" });
    await expect(duplicates.getByRole("link", { name: "K-00001 · Müller Maschinenbau GmbH" })).toBeVisible();
    await duplicates.getByRole("button", { name: "Trotzdem anlegen" }).click();
    await expect(page.getByText("K-00002")).toBeVisible();
  });

  test("Ansprechpartner und Aufgabe mit Fälligkeit in Ortszeit", async () => {
    await page.goto(customerUrl);
    const contactForm = page.locator("details").filter({ has: page.locator("summary", { hasText: "Ansprechpartner hinzufügen" }) });
    await contactForm.locator("summary").click();
    await contactForm.getByLabel("Vorname").fill("Anna");
    await contactForm.getByLabel("Nachname").fill("Müller");
    await contactForm.getByLabel("Position").fill("Geschäftsführerin");
    await contactForm.getByLabel("Hauptansprechpartner").check();
    await contactForm.getByRole("button", { name: "Ansprechpartner hinzufügen" }).click();
    await expect(page.getByRole("region", { name: "Ansprechpartner" }).getByText("Anna Müller")).toBeVisible();

    const activity = page.getByRole("region", { name: "Verlauf und Aufgaben" });
    await activity.getByLabel("Art").selectOption("task");
    await activity.getByLabel("Betreff").fill("Angebot nachfassen");
    await activity.getByRole("button", { name: "Eintrag speichern" }).click();
    await expect(activity.getByText("Aufgaben brauchen ein Fälligkeitsdatum.")).toBeVisible();
    await activity.getByLabel("Fällig am (für Aufgaben)").fill("2030-01-15T10:30");
    await activity.getByRole("button", { name: "Eintrag speichern" }).click();
    // Fälligkeit wird in der Zeitzone des Unternehmens (Europe/Berlin) angezeigt – genau wie eingegeben
    await expect(activity.getByText(/fällig 15\.01\.2030, 10:30/)).toBeVisible();

    await activity.getByRole("button", { name: "„Angebot nachfassen“ als erledigt markieren" }).click();
    await expect(activity.getByRole("button", { name: "„Angebot nachfassen“ wieder öffnen" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Liste: Suche, Filter und Archiv", async () => {
    await page.goto(`${base}/crm/kunden?q=augsburg`);
    await expect(page.getByRole("table")).toContainText("Müller Maschinenbau GmbH");
    await expect(page.getByRole("table")).not.toContainText("Mueller Maschinenbau GmbH");
    await page.goto(`${base}/crm/kunden?status=inactive`);
    await expect(page.getByText("Keine Kunden gefunden")).toBeVisible();

    await page.goto(customerUrl);
    await page.getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByText("Archiviert", { exact: true })).toBeVisible();
    await page.goto(`${base}/crm/kunden`);
    await expect(page.getByRole("table")).not.toContainText("Müller Maschinenbau GmbH");
    await page.goto(`${base}/crm/kunden?archiv=1`);
    await expect(page.getByRole("table")).toContainText("Müller Maschinenbau GmbH");
    await expectAccessible(page);
  });

  test("Globale Suche findet Kunden und Ansprechpartner", async () => {
    await page.goto(`${base}/suche?q=anna`);
    await expect(page.getByRole("region", { name: "Ansprechpartner" }).getByRole("link", { name: "Anna Müller" })).toBeVisible();
    await page.goto(`${base}/suche?q=K-00002`);
    await expect(page.getByRole("region", { name: "Kunden" }).getByRole("link", { name: "Mueller Maschinenbau GmbH" })).toBeVisible();
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/crm`, `${base}/crm/kunden?archiv=1`, customerUrl]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Andere Unternehmen sehen keine Kunden", async ({ browser }) => {
    const other = await newTenant(browser, "crm-fremd", "Fremdfirma");
    await other.page.goto(customerUrl);
    await expect(other.page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await other.page.goto(customerUrl.replace(base, other.base));
    await expect(other.page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await other.page.goto(`${other.base}/suche?q=mueller`);
    await expect(other.page.getByText("Keine Treffer")).toBeVisible();
  });
});
