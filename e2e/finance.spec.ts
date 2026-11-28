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
const gross = (page: Page) => page.getByRole("region", { name: /^Positionen/ }).getByTestId("gross-total");
const status = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true });
const euro = (text: string) => new RegExp(text.replace(/\./g, "\\.").replace(" €", "\\s€"));

test.describe("Finanzen", () => {
  let page: Page;
  let base = "";
  let invoiceUrl = "";
  let customerUrl = "";
  const year = new Date().getFullYear();

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await signUpAndConfirm(page, uniqueEmail("finanzen"));
    await page.getByLabel("Name des Unternehmens").fill("Studio Süd");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;

    await page.goto(`${base}/crm/kunden/neu`);
    await page.getByLabel("Name", { exact: true }).fill("Nordlicht GmbH");
    await page.getByLabel("Straße und Hausnummer").fill("Hafenweg 3");
    await page.getByLabel("Postleitzahl").fill("20457");
    await page.getByLabel("Ort").fill("Hamburg");
    await page.getByRole("button", { name: "Kunde anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Nordlicht GmbH", level: 1 })).toBeVisible();
    customerUrl = new URL(page.url()).pathname;
  });

  test("Übersicht verlangt zuerst Rechnungsdaten; IBAN wird geprüft", async () => {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: "Finanzen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Finanzen", level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Bevor du Rechnungen ausstellen kannst");
    await expectAccessible(page);

    await page.getByRole("link", { name: "Rechnungsdaten eintragen" }).click();
    const settings = page.getByRole("region", { name: "Firma, Steuer und Bank" });
    await settings.getByLabel("Firmenname (wie im Handelsregister)").fill("Studio Süd GmbH");
    await settings.getByLabel("Straße und Hausnummer").fill("Marktplatz 1");
    await settings.getByLabel("PLZ").fill("80331");
    await settings.getByLabel("Ort").fill("München");
    await settings.getByLabel("Steuernummer").fill("143/123/45678");
    await settings.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 01");
    await settings.getByRole("button", { name: "Rechnungsdaten speichern" }).click();
    await expect(settings.getByText("Diese IBAN ist ungültig.")).toBeVisible();
    await settings.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 00");
    await settings.getByRole("button", { name: "Rechnungsdaten speichern" }).click();
    await expect(page.getByText("Rechnungsdaten gespeichert.")).toBeVisible();
    await expectAccessible(page);
  });

  test("Artikel anlegen", async () => {
    await page.goto(`${base}/finanzen/artikel`);
    const form = page.getByRole("form", { name: "Neuer Artikel" });
    await form.getByLabel("Neuer Artikel").fill("Beratung");
    await form.getByLabel("Einheit").fill("Std.");
    await form.getByLabel("Preis netto (€)").fill("120,00");
    await form.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByText("Artikel „Beratung“ angelegt.")).toBeVisible();
    await expect(page.getByRole("form", { name: "Artikel Beratung" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Rechnungsentwurf mit Positionen, Summen je Steuersatz", async () => {
    await page.goto(`${base}/finanzen/neu?art=rechnung`);
    const basics = page.getByRole("region", { name: "Grunddaten" });
    await basics.getByRole("button", { name: "Rechnung anlegen" }).click();
    await expect(basics.getByText("Bitte wähle einen Kunden.")).toBeVisible();
    await basics.getByLabel("Kunde").selectOption({ index: 1 });
    await basics.getByLabel("Betreff").fill("Beratung November");
    await basics.getByRole("button", { name: "Rechnung anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Rechnung (Entwurf)", level: 1 })).toBeVisible();
    invoiceUrl = new URL(page.url()).pathname;

    const add = page.getByRole("form", { name: "Neue Position" });
    await add.getByLabel("Aus Artikel übernehmen").selectOption({ label: "Beratung" });
    await expect(add.getByLabel("Bezeichnung")).toHaveValue("Beratung");
    await add.getByLabel("Menge").fill("2");
    await add.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByRole("form", { name: "Position Beratung" })).toBeVisible();

    await add.getByLabel("Bezeichnung").fill("Fachbuch");
    await add.getByLabel("Einzelpreis (€)").fill("50");
    await add.getByLabel("Rabatt %").fill("10");
    await add.getByLabel("USt").selectOption("7");
    await add.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByRole("form", { name: "Position Fachbuch" })).toBeVisible();

    // 2 × 120 = 240 (19 % = 45,60) + 45 (7 % = 3,15) → 333,75
    await expect(gross(page)).toHaveText(euro("333,75 €"));
    await expectAccessible(page);

    await page.getByRole("button", { name: "Fachbuch nach oben" }).click();
    await expect(page.getByRole("form").filter({ has: page.getByLabel("Bezeichnung") }).first()).toHaveAttribute("aria-label", "Position Fachbuch");
  });

  test("Ausstellen vergibt die Nummer und sperrt den Beleg; PDF wird erzeugt", async () => {
    await page.goto(invoiceUrl);
    await page.getByRole("button", { name: "Rechnung ausstellen" }).click();
    await expect(page.getByRole("heading", { name: `Rechnung RE-${year}-0001`, level: 1 })).toBeVisible();
    await expect(page.getByRole("form", { name: "Neue Position" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Angaben" })).toContainText("Hafenweg 3");
    await expect(page.getByRole("region", { name: "Zahlungen" })).toContainText("Noch offen: 333,75");
    await expectAccessible(page);

    const pdf = await page.request.get(`${invoiceUrl}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    const body = await pdf.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    await test.info().attach("rechnung.pdf", { body, contentType: "application/pdf" });
  });

  test("Teilzahlung und Restzahlung setzen den Status", async () => {
    const payments = page.getByRole("region", { name: "Zahlungen" });
    await payments.getByLabel("Betrag (€)").fill("100");
    await payments.getByRole("button", { name: "Zahlung erfassen" }).click();
    await expect(payments).toContainText("Noch offen: 233,75");
    await expect(status(page, "Teilweise bezahlt")).toBeVisible();

    await payments.getByRole("button", { name: "Zahlung erfassen" }).click();
    await expect(payments).toContainText("Vollständig bezahlt.");
    await expect(status(page, "Bezahlt")).toBeVisible();

    await page.goto(`${base}/finanzen`);
    await expect(page.getByText("Alle ausgestellten Rechnungen sind bezahlt.")).toBeVisible();
  });

  test("Storno erzeugt eine Gutschrift, die Rechnung bleibt erhalten", async () => {
    await page.goto(invoiceUrl);
    const cancel = page.getByRole("region", { name: "Stornieren" });
    await cancel.getByRole("button", { name: "Stornieren" }).click();
    await expect(cancel.getByText("Bitte einen Grund für das Storno angeben")).toBeVisible();
    await cancel.getByLabel("Grund für das Storno").fill("Falscher Leistungszeitraum");
    await cancel.getByRole("button", { name: "Stornieren" }).click();
    await expect(page.getByRole("heading", { name: `Gutschrift GS-${year}-0001`, level: 1 })).toBeVisible();
    await expect(gross(page)).toHaveText(euro("-333,75 €"));
    await page.getByRole("navigation", { name: "Zugehörige Belege" }).getByRole("link", { name: `Rechnung RE-${year}-0001` }).click();
    await expect(status(page, "Storniert")).toBeVisible();
    await expect(page.getByRole("region", { name: "Stornieren" })).toHaveCount(0);

    await page.goto(`${base}/finanzen/gutschriften`);
    await expect(page.getByRole("link", { name: `GS-${year}-0001` })).toBeVisible();
    await expectAccessible(page);
  });

  test("Angebot ausstellen, annehmen und in Rechnung übernehmen", async () => {
    await page.goto(customerUrl);
    const documents = page.getByRole("region", { name: "Angebote und Rechnungen" });
    await expect(documents.getByRole("link", { name: `Rechnung RE-${year}-0001` })).toBeVisible();
    await expect(documents.getByRole("link", { name: `Gutschrift GS-${year}-0001` })).toBeVisible();
    await documents.getByRole("link", { name: "Neues Angebot" }).click();
    const basics = page.getByRole("region", { name: "Grunddaten" });
    await expect(basics.getByLabel("Kunde")).not.toHaveValue("");
    await basics.getByRole("button", { name: "Angebot anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Angebot (Entwurf)", level: 1 })).toBeVisible();
    const add = page.getByRole("form", { name: "Neue Position" });
    await add.getByLabel("Bezeichnung").fill("Workshop");
    await add.getByLabel("Einzelpreis (€)").fill("1.000");
    await add.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(gross(page)).toHaveText(euro("1.190,00 €"));

    await page.getByRole("button", { name: "Angebot ausstellen" }).click();
    await expect(page.getByRole("heading", { name: `Angebot AN-${year}-0001`, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Als angenommen markieren" }).click();
    await expect(status(page, "Angenommen")).toBeVisible();
    await page.getByRole("button", { name: "In Rechnung übernehmen" }).click();
    await expect(page.getByRole("heading", { name: "Rechnung (Entwurf)", level: 1 })).toBeVisible();
    await expect(page.getByRole("form", { name: "Position Workshop" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kopfdaten" }).getByLabel("Einleitungstext")).toHaveValue(`Vielen Dank für Ihren Auftrag zu unserem Angebot AN-${year}-0001.`);

    await page.getByRole("button", { name: "Entwurf löschen" }).click();
    await expect(page).toHaveURL(`${base}/finanzen`);
    await page.goto(`${base}/finanzen/rechnungen`);
    await expect(page.getByRole("link", { name: `RE-${year}-0001` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Entwurf" })).toHaveCount(0);
  });
});
