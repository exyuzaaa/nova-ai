import { readFile } from "node:fs/promises";
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

const CSV = [
  "Firma;E-Mail;PLZ;Ort;Land;Status",
  "Alpha GmbH;info@alpha.example;10115;Berlin;Deutschland;Aktiv",
  "Beta AG;kaputt;20095;Hamburg;DE;Interessent",
  "Gamma KG;;80331;München;Österreich;",
  "alpha gmbh;;;;;",
  '"=HYPERLINK(""http://böse.example"")";;;;;',
].join("\r\n");

test.describe("CRM: Import, Export und Pipeline-Einstellungen", () => {
  let page: Page;
  let base = "";

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, acceptDownloads: true })).newPage();
    await signUpAndConfirm(page, uniqueEmail("crm-daten"));
    await page.getByLabel("Name des Unternehmens").fill("Datenwerk");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;
  });

  test("CSV-Import mit Prüfung, Fehlern und Dubletten", async () => {
    await page.goto(`${base}/crm`);
    await page.getByRole("navigation", { name: "CRM-Bereiche" }).getByRole("link", { name: "Import" }).click();
    await expect(page.getByRole("heading", { name: "Kunden importieren", level: 1 })).toBeVisible();
    await page.getByLabel("CSV-Datei", { exact: true }).setInputFiles({ name: "kunden.csv", mimeType: "text/csv", buffer: Buffer.from(`﻿${CSV}`) });

    await expect(page.getByText("kunden.csv: 5 Zeilen")).toBeVisible();
    await expect(page.getByLabel("Name (Pflicht)")).toHaveValue("0");
    await expect(page.getByLabel("Telefon")).toHaveValue("-1");
    await expectAccessible(page);

    await page.getByRole("button", { name: "Daten prüfen" }).click();
    const step = page.getByRole("region", { name: "3. Prüfergebnis und Import" });
    await expect(step.getByText("Zeile 3:")).toBeVisible();
    await expect(step.getByText(/E-Mail-Adresse: /)).toBeVisible();
    await expect(step.getByRole("listitem").filter({ hasText: "Zeile 5:" })).toContainText("wie Zeile 2 in dieser Datei");

    await step.getByRole("button", { name: "3 Kunden importieren" }).click();
    await expect(page.getByText("3 Kunden importiert, 1 Dubletten übersprungen, 1 Zeilen mit Fehlern nicht importiert.")).toBeVisible();
    await page.getByRole("link", { name: "Zur Kundenliste" }).click();
    await expect(page.getByText("3 Kunden", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gamma KG" })).toBeVisible();
  });

  test("CSV-Export ist Excel-tauglich, entschärft Formeln und wird protokolliert", async () => {
    await page.goto(`${base}/crm/kunden`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV-Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^nova-kunden-.+\.csv$/);
    const content = await readFile((await download.path())!, "utf8");
    expect(content.startsWith("﻿Kundennummer;Art;Name;E-Mail")).toBe(true);
    expect(content).toContain("K-00001;Firma;Alpha GmbH;info@alpha.example");
    expect(content).toContain(";AT;Aktiv;");
    expect(content).toContain(`"'=HYPERLINK(""http://böse.example"")"`);

    // Exportierte Datei lässt sich wieder einlesen – alles wird als Dublette erkannt
    // Über den Reiter öffnen: dann ist die Seite sicher interaktiv, bevor die Datei gewählt wird
    await page.getByRole("navigation", { name: "CRM-Bereiche" }).getByRole("link", { name: "Import" }).click();
    await expect(page.getByRole("heading", { name: "Kunden importieren", level: 1 })).toBeVisible();
    await page.getByLabel("CSV-Datei", { exact: true }).setInputFiles({ name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(content) });
    await page.getByRole("button", { name: "Daten prüfen" }).click();
    const step = page.getByRole("region", { name: "3. Prüfergebnis und Import" });
    await expect(step.getByRole("listitem").filter({ hasText: "Zeile 2:" })).toContainText("wie K-00001 „Alpha GmbH“");
    await expect(step.getByRole("button", { name: "0 Kunden importieren" })).toBeDisabled();

    await page.goto(`${base}/verwaltung/protokoll`);
    await expect(page.getByText("Kunden als CSV exportiert (3 Zeilen)")).toBeVisible();
  });

  test("Leads-Export", async () => {
    await page.goto(`${base}/crm/leads`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV-Export" }).click();
    const content = await readFile((await (await downloadPromise).path())!, "utf8");
    expect(content.replace(/\r\n$/, "")).toBe("﻿Leadnummer;Titel;Firma;Ansprechpartner;E-Mail;Telefon;Quelle;Status;Bewertung;Geschätzter Wert (EUR);Zuständig;Wiedervorlage;Notizen;Angelegt");
  });

  test("Pipeline-Phasen bearbeiten, ergänzen, sortieren und löschen", async () => {
    await page.goto(`${base}/crm`);
    await page.getByRole("navigation", { name: "CRM-Bereiche" }).getByRole("link", { name: "Einstellungen" }).click();
    await expect(page.getByRole("heading", { name: "CRM-Einstellungen", level: 1 })).toBeVisible();
    const pipeline = page.getByRole("region", { name: "Pipeline: Vertrieb" });

    const offer = pipeline.getByRole("listitem", { name: "Phase Angebot" });
    await offer.getByLabel("Name der Phase").fill("Angebot verschickt");
    await offer.getByLabel("Wahrscheinlichkeit %").fill("60");
    await offer.getByRole("button", { name: "Speichern" }).click();
    await expect(offer.getByText("Phase gespeichert.")).toBeVisible();

    const won = pipeline.getByRole("listitem", { name: "Phase Gewonnen" });
    await expect(won.getByText("Abschluss gewonnen · 100 %")).toBeVisible();
    await expect(won.getByRole("button", { name: /löschen/ })).toHaveCount(0);

    await pipeline.getByLabel("Neue Phase").fill("Vor-Ort-Termin");
    await pipeline.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(pipeline.getByText("Phase „Vor-Ort-Termin“ hinzugefügt.")).toBeVisible();
    const phaseNames = () => pipeline.getByLabel("Name der Phase").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    await expect.poll(phaseNames).toEqual(["Neu", "Qualifiziert", "Angebot verschickt", "Verhandlung", "Vor-Ort-Termin", "Gewonnen", "Verloren"]);

    await pipeline.getByRole("button", { name: "Vor-Ort-Termin nach oben" }).click();
    await expect.poll(phaseNames).toEqual(["Neu", "Qualifiziert", "Angebot verschickt", "Vor-Ort-Termin", "Verhandlung", "Gewonnen", "Verloren"]);
    await expect(pipeline.getByRole("button", { name: "Neu nach oben" })).toBeDisabled();

    page.once("dialog", (dialog) => dialog.accept());
    await pipeline.getByRole("button", { name: "Phase Vor-Ort-Termin löschen" }).click();
    await expect.poll(phaseNames).toEqual(["Neu", "Qualifiziert", "Angebot verschickt", "Verhandlung", "Gewonnen", "Verloren"]);
    await expectAccessible(page);

    await page.goto(`${base}/crm/pipeline`);
    await expect(page.getByRole("listitem", { name: "Phase Angebot verschickt" })).toContainText("60 %");
  });

  test("Weitere Pipeline anlegen und als Standard festlegen", async () => {
    await page.goto(`${base}/crm/einstellungen`);
    const create = page.getByRole("region", { name: "Weitere Pipeline" });
    await create.getByLabel("Name").fill("Vertrieb");
    await create.getByRole("button", { name: "Pipeline anlegen" }).click();
    await expect(create.getByText("Eine Pipeline mit diesem Namen gibt es schon.")).toBeVisible();
    await create.getByLabel("Name").fill("Service");
    await create.getByRole("button", { name: "Pipeline anlegen" }).click();

    const service = page.getByRole("region", { name: "Pipeline: Service" });
    await expect(service.getByLabel("Name der Phase")).toHaveCount(4);
    await service.getByRole("button", { name: "Als Standard festlegen" }).click();
    await expect(service.getByText("Standard", { exact: true })).toBeVisible();

    const sales = page.getByRole("region", { name: "Pipeline: Vertrieb" });
    page.once("dialog", (dialog) => dialog.accept());
    await sales.getByRole("button", { name: "Pipeline löschen" }).click();
    await expect(sales).toHaveCount(0);

    await page.goto(`${base}/crm/pipeline`);
    await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible();
    await expect(page.getByRole("listitem", { name: "Phase Angebot" })).toBeVisible();
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/crm/import`, `${base}/crm/einstellungen`, `${base}/crm/kunden`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
  });
});
