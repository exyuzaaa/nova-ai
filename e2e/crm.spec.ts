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

  test("Lead erfassen und in neuen Kunden mit Verkaufschance umwandeln", async () => {
    await page.goto(`${base}/crm/leads`);
    await expect(page.getByText("Keine offenen Leads")).toBeVisible();
    await page.getByRole("link", { name: "Neuer Lead" }).click();
    await page.getByLabel("Titel").fill("Anfrage Website-Relaunch");
    await page.getByLabel("Firma").fill("Bäckerei Sonne");
    await page.getByLabel("Ansprechperson").fill("Maria Clara Sonne");
    await page.getByLabel("Geschätzter Wert (€)").fill("8.5x");
    await page.getByRole("button", { name: "Lead anlegen" }).click();
    await expect(page.getByText("Bitte gib einen gültigen Betrag ein")).toBeVisible();
    // Eingaben bleiben nach dem Fehler erhalten
    await expect(page.getByLabel("Firma")).toHaveValue("Bäckerei Sonne");
    await page.getByLabel("Geschätzter Wert (€)").fill("8.500");
    await page.getByLabel("Wiedervorlage").fill("2030-03-02T09:15");
    await page.getByRole("button", { name: "Lead anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Anfrage Website-Relaunch", level: 1 })).toBeVisible();
    await expect(page.getByText("L-00001")).toBeVisible();
    await expect(page.getByText("8.500,00 €")).toBeVisible();
    await expect(page.getByText("Wiedervorlage 02.03.2030, 09:15")).toBeVisible();

    const activity = page.getByRole("region", { name: "Verlauf und Aufgaben" });
    await activity.getByLabel("Art").selectOption("call");
    await activity.getByLabel("Betreff").fill("Erstgespräch geführt");
    await activity.getByRole("button", { name: "Eintrag speichern" }).click();
    await expect(activity.getByText("Erstgespräch geführt")).toBeVisible();
    await expectAccessible(page);

    const convert = page.getByRole("region", { name: "In Kunden umwandeln" });
    await expect(convert.getByLabel("Verkaufschance in der Pipeline anlegen")).toBeChecked();
    await convert.getByRole("button", { name: "In Kunden umwandeln" }).click();
    await expect(page.getByRole("heading", { name: "Bäckerei Sonne", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ansprechpartner" })).toContainText("Maria Clara Sonne");
    await expect(page.getByRole("region", { name: "Verkaufschancen" })).toContainText("8.500,00 €");
    await expect(page.getByRole("region", { name: "Verlauf und Aufgaben" })).toContainText("Erstgespräch geführt");

    await page.goto(`${base}/crm/leads?status=converted`);
    await page.getByRole("link", { name: "Anfrage Website-Relaunch" }).click();
    await expect(page.getByText("in einen Kunden umgewandelt")).toBeVisible();
    await expect(page.getByRole("region", { name: "In Kunden umwandeln" })).toHaveCount(0);
  });

  test("Lead einem bestehenden Kunden zuordnen", async () => {
    await page.goto(`${base}/crm/leads/neu`);
    await page.getByLabel("Titel").fill("Wartung Anlage 3");
    await page.getByLabel("Firma").fill("Müller Maschinenbau GmbH");
    await page.getByRole("button", { name: "Lead anlegen" }).click();
    await expect(page.getByText("L-00002")).toBeVisible();
    const convert = page.getByRole("region", { name: "In Kunden umwandeln" });
    // K-00001 ist archiviert und wird deshalb nicht vorgeschlagen, K-00002 schon
    await expect(convert.getByLabel(/K-00001/)).toHaveCount(0);
    await convert.getByLabel(/Bestehendem Kunden zuordnen: K-00002/).check();
    await convert.getByLabel("Verkaufschance in der Pipeline anlegen").uncheck();
    await convert.getByRole("button", { name: "In Kunden umwandeln" }).click();
    await expect(page.getByRole("heading", { name: "Mueller Maschinenbau GmbH", level: 1 })).toBeVisible();
  });

  test("Pipeline: Verkaufschance anlegen, Phase wechseln, Umsatz im Dashboard", async () => {
    await page.goto(customerUrl);
    // Archivierte Kunden bekommen keine neuen Verkaufschancen – erst wiederherstellen
    const opportunities = page.getByRole("region", { name: "Verkaufschancen" });
    await expect(opportunities.locator("summary", { hasText: "Neue Verkaufschance" })).toHaveCount(0);
    await page.getByRole("button", { name: "Wiederherstellen" }).click();
    await expect(page.getByRole("button", { name: "Archivieren" })).toBeVisible();
    await opportunities.locator("summary", { hasText: "Neue Verkaufschance" }).click();
    await opportunities.getByLabel("Titel").fill("Wartungsvertrag 2027");
    await opportunities.getByLabel("Betrag (€)").fill("");
    await opportunities.getByRole("button", { name: "Verkaufschance anlegen" }).click();
    await expect(opportunities.getByText("Bitte gib einen Betrag ein")).toBeVisible();
    await opportunities.getByLabel("Betrag (€)").fill("24.000");
    await opportunities.getByLabel("Erwarteter Abschluss").fill("2030-06-30");
    await opportunities.getByRole("button", { name: "Verkaufschance anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Wartungsvertrag 2027", level: 1 })).toBeVisible();
    await expect(page.getByText("24.000,00 €").first()).toBeVisible();
    await expect(page.getByText("gewichtet 2.400,00 €")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Pipeline", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${base}/crm/pipeline`));
    const neu = page.getByRole("listitem", { name: "Phase Neu" });
    await expect(neu.getByRole("link", { name: "Wartungsvertrag 2027" })).toBeVisible();
    await expect(neu.getByRole("link", { name: "Anfrage Website-Relaunch" })).toBeVisible();
    await expectAccessible(page);

    await neu.getByRole("combobox", { name: "Phase von Wartungsvertrag 2027" }).selectOption({ label: "Gewonnen" });
    await neu.getByRole("button", { name: "Wartungsvertrag 2027 in gewählte Phase verschieben" }).click();
    const won = page.getByRole("listitem", { name: "Phase Gewonnen" });
    await expect(won.getByRole("link", { name: "Wartungsvertrag 2027" })).toBeVisible();

    await page.goto(`${base}/crm`);
    await expect(page.getByRole("link", { name: /Gewonnen diesen Monat\s*24\.000,00 €/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Offene Pipeline\s*8\.500,00 €/ })).toBeVisible();
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/crm`, `${base}/crm/kunden?archiv=1`, customerUrl, `${base}/crm/leads?status=all`, `${base}/crm/pipeline`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
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
