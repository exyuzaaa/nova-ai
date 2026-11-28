import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpAndConfirm } from "./support/auth";
import { startGoogleMock, type GoogleMock } from "./support/google-mock";
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

test.describe("Belegversand per Gmail", () => {
  let page: Page;
  let base = "";
  let invoiceUrl = "";
  let google: GoogleMock;
  const year = new Date().getFullYear();

  test.beforeAll(async ({ browser }) => {
    google = await startGoogleMock(Number(process.env.E2E_GOOGLE_PORT ?? 3199), "rechnung@studio-ost.example");
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    page.on("dialog", (dialog) => dialog.accept());
    await signUpAndConfirm(page, uniqueEmail("gmail"));
    await page.getByLabel("Name des Unternehmens").fill("Studio Ost");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;

    await page.goto(`${base}/crm/kunden/neu`);
    await page.getByLabel("Name", { exact: true }).fill("Nordlicht GmbH");
    await page.getByLabel("E-Mail-Adresse").fill("einkauf@nordlicht.example");
    await page.getByLabel("Straße und Hausnummer").fill("Hafenweg 3");
    await page.getByLabel("Ort").fill("Hamburg");
    await page.getByRole("button", { name: "Kunde anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Nordlicht GmbH", level: 1 })).toBeVisible();

    await page.goto(`${base}/finanzen/einstellungen`);
    const settings = page.getByRole("region", { name: "Firma, Steuer und Bank" });
    await settings.getByLabel("Firmenname (wie im Handelsregister)").fill("Studio Ost GmbH");
    await settings.getByLabel("Straße und Hausnummer").fill("Ring 2");
    await settings.getByLabel("Ort").fill("Leipzig");
    await settings.getByLabel("Steuernummer").fill("231/100/12345");
    await settings.getByRole("button", { name: "Rechnungsdaten speichern" }).click();
    await expect(settings.getByText("Rechnungsdaten gespeichert.")).toBeVisible();
  });

  test.afterAll(async () => {
    await google?.close();
  });

  test("Verbinden: Abbruch bei Google ändert nichts, danach erfolgreich", async () => {
    const mail = page.getByRole("region", { name: "E-Mail-Versand (Gmail)" });
    google.mode = "deny";
    await mail.getByRole("link", { name: "Mit Gmail verbinden" }).click();
    await expect(page.getByRole("region", { name: "E-Mail-Versand (Gmail)" }).getByRole("status")).toContainText("abgebrochen");

    google.mode = "ok";
    await page.getByRole("region", { name: "E-Mail-Versand (Gmail)" }).getByRole("link", { name: "Mit Gmail verbinden" }).click();
    const connected = page.getByRole("region", { name: "E-Mail-Versand (Gmail)" });
    await expect(connected.getByRole("status")).toContainText("Gmail ist verbunden");
    await expect(connected).toContainText("Verbunden mit rechnung@studio-ost.example");
    await expectAccessible(page);
  });

  test("Entwürfe lassen sich nicht versenden; ausgestellte Rechnung geht mit PDF raus", async () => {
    await page.goto(`${base}/finanzen/neu?art=rechnung`);
    const basics = page.getByRole("region", { name: "Grunddaten" });
    await basics.getByLabel("Kunde").selectOption({ index: 1 });
    await basics.getByRole("button", { name: "Rechnung anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Rechnung (Entwurf)", level: 1 })).toBeVisible();
    invoiceUrl = new URL(page.url()).pathname;
    const add = page.getByRole("form", { name: "Neue Position" });
    await add.getByLabel("Bezeichnung").fill("Beratung");
    await add.getByLabel("Einzelpreis (€)").fill("100");
    await add.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByRole("form", { name: "Position Beratung" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Per E-Mail senden" })).toHaveCount(0);

    await page.getByRole("button", { name: "Rechnung ausstellen" }).click();
    await expect(page.getByRole("heading", { name: `Rechnung RE-${year}-0001`, level: 1 })).toBeVisible();
    const send = page.getByRole("region", { name: "Per E-Mail senden" });
    await expect(send.getByLabel("An")).toHaveValue("einkauf@nordlicht.example");
    await expect(send.getByLabel("Betreff")).toHaveValue(`Rechnung RE-${year}-0001 – Studio Ost GmbH`);
    await expect(send).toContainText(`Anhang: RE-${year}-0001.pdf`);
    await expectAccessible(page);

    await send.getByLabel("Kopie (CC)").fill("kein-gueltiger-empfaenger");
    await send.getByRole("button", { name: "E-Mail senden" }).click();
    await expect(send.getByText("Kopie (CC): bitte gültige E-Mail-Adressen eingeben")).toBeVisible();
    expect(google.sent).toHaveLength(0);

    await send.getByLabel("Kopie (CC)").fill("buchhaltung@studio-ost.example");
    await send.getByRole("button", { name: "E-Mail senden" }).click();
    await expect(send.getByText("E-Mail an einkauf@nordlicht.example gesendet.")).toBeVisible();
    await expect(send.getByRole("list", { name: "Versandverlauf" })).toContainText("an einkauf@nordlicht.example (CC: buchhaltung@studio-ost.example)");

    expect(google.sent).toHaveLength(1);
    const message = google.sent[0];
    expect(message).toMatch(/^From: "Studio Ost GmbH" <rechnung@studio-ost\.example>\r$/m);
    expect(message).toMatch(/^To: einkauf@nordlicht\.example\r$/m);
    expect(message).toMatch(/^Cc: buchhaltung@studio-ost\.example\r$/m);
    expect(message).toContain(`filename="RE-${year}-0001.pdf"`);
    expect(message).toContain(Buffer.from("%PDF-").toString("base64").slice(0, 6));
  });

  test("Widerrufener Zugang wird verständlich gemeldet", async () => {
    google.mode = "revoked";
    await page.goto(invoiceUrl);
    const send = page.getByRole("region", { name: "Per E-Mail senden" });
    await send.getByRole("button", { name: "E-Mail senden" }).click();
    await expect(send.getByText("Google hat den Zugriff widerrufen oder er ist abgelaufen. Bitte Gmail neu verbinden.")).toBeVisible();
    expect(google.sent).toHaveLength(1);

    await page.goto(`${base}/finanzen/einstellungen`);
    await expect(page.getByRole("region", { name: "E-Mail-Versand (Gmail)" }).getByRole("alert")).toContainText("Letzter Versand fehlgeschlagen");
  });

  test("Trennen entfernt die Verbindung und widerruft die Freigabe", async () => {
    google.mode = "ok";
    const mail = page.getByRole("region", { name: "E-Mail-Versand (Gmail)" });
    await mail.getByRole("button", { name: "Gmail trennen" }).click();
    await expect(mail.getByRole("link", { name: "Mit Gmail verbinden" })).toBeVisible();
    expect(google.revoked).toEqual(["RT-1"]);

    await page.goto(invoiceUrl);
    await expect(page.getByRole("region", { name: "Per E-Mail senden" })).toContainText("Es ist noch kein Gmail-Konto verbunden.");
    await expect(page.getByRole("list", { name: "Versandverlauf" })).toContainText("einkauf@nordlicht.example");
  });
});
