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

/** Montag in etwa fünf Wochen (innerhalb der 8-Wochen-Übersicht, im Zweifel im selben Jahr wie heute nicht nötig). */
const mondayInWeeks = (weeks: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};
const plus = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

test.describe("Personal", () => {
  let page: Page;
  let base = "";
  let email = "";
  let lenaUrl = "";
  const monday = mondayInWeeks(5);

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    email = uniqueEmail("personal");
    await signUpAndConfirm(page, email);
    await page.getByLabel("Name des Unternehmens").fill("Werkstatt Ost");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;
  });

  test("Mitarbeiter anlegen mit Prüfung, eigener Zugang wird verknüpft", async () => {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: "Personal", exact: true }).click();
    await expect(page.getByText("Noch keine Mitarbeiter")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Neuer Mitarbeiter" }).click();
    await page.getByRole("button", { name: "Mitarbeiter anlegen" }).click();
    await expect(page.getByText("Bitte gib den Vornamen ein.")).toBeVisible();
    await page.getByLabel("Vorname").fill("Mara");
    await page.getByLabel("Nachname").fill("Meister");
    await page.getByLabel("Position").fill("Werkstattleitung");
    await page.getByLabel("NOVA-Zugang").selectOption({ label: email });
    await expectAccessible(page);
    await page.getByRole("button", { name: "Mitarbeiter anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Mara Meister", level: 1 })).toBeVisible();
    await expect(page.getByText("MA-00001")).toBeVisible();
    await expect(page.getByRole("region", { name: /Urlaub \d{4}/ })).toContainText("30 Tage");
  });

  test("Zweite Person mit Vorgesetzter, vertrauliche Daten mit IBAN-Prüfung", async () => {
    await page.goto(`${base}/personal/neu`);
    await page.getByLabel("Vorname").fill("Lena");
    await page.getByLabel("Nachname").fill("Lager");
    await page.getByLabel("Vorgesetzte Person").selectOption({ label: "Mara Meister" });
    await page.getByLabel("Beschäftigung").selectOption("part_time");
    await page.getByLabel("Wochenstunden").fill("20");
    await page.getByLabel("Freitag").uncheck();
    await page.getByRole("button", { name: "Mitarbeiter anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Lena Lager", level: 1 })).toBeVisible();
    lenaUrl = new URL(page.url()).pathname;

    const secret = page.getByRole("region", { name: "Vertrauliche Daten" });
    await secret.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 01");
    await secret.getByRole("button", { name: "Vertrauliche Daten speichern" }).click();
    await expect(secret.getByText("Diese IBAN ist ungültig.")).toBeVisible();
    await secret.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 00");
    await secret.getByLabel("Vergütung (€)").fill("1.650,00");
    await secret.getByLabel("Vergütung je").selectOption("month");
    await secret.getByRole("button", { name: "Vertrauliche Daten speichern" }).click();
    await expect(secret.getByText("Vertrauliche Daten gespeichert.")).toBeVisible();
    await expectAccessible(page);

    await page.goto(`${base}/verwaltung/protokoll`);
    await expect(page.getByText("Vertrauliche Daten von MA-00002 erfasst")).toBeVisible();
    await expect(page.getByText("1.650")).toHaveCount(0);
  });

  test("Feiertag eintragen, Urlaub beantragen und genehmigen", async () => {
    await page.goto(`${base}/personal/einstellungen`);
    const holidays = page.getByRole("region", { name: "Feiertage" });
    await holidays.getByLabel("Datum").fill(plus(monday, 2));
    await holidays.getByLabel("Feiertag").fill("Betriebsfeiertag");
    await holidays.getByRole("button", { name: "Eintragen" }).click();
    await expect(holidays.getByText("Feiertag „Betriebsfeiertag“ eingetragen.")).toBeVisible();

    await page.getByRole("navigation", { name: "Personalbereiche" }).getByRole("link", { name: "Abwesenheiten" }).click();
    const form = page.getByRole("region", { name: "Neuer Antrag" });
    await form.getByLabel("Für").selectOption({ label: "Lena Lager" });
    await form.getByLabel("Von").fill(plus(monday, 4));
    await form.getByLabel("Bis").fill(monday);
    await form.getByRole("button", { name: "Beantragen" }).click();
    await expect(form.getByText("Das Ende liegt vor dem Beginn.")).toBeVisible();
    await form.getByLabel("Von").fill(monday);
    await form.getByLabel("Bis").fill(plus(monday, 6));
    await form.getByRole("button", { name: "Beantragen" }).click();
    await expect(form.getByText("Antrag gespeichert.")).toBeVisible();

    // Mo–So, Arbeitstage Mo–Do, Mittwoch Feiertag → 3 Tage
    const decide = page.getByRole("region", { name: /Zu entscheiden/ });
    const request = decide.getByRole("listitem", { name: "Antrag von Lena Lager" });
    await expect(request).toContainText("(3 Tage)");
    await expectAccessible(page);
    await request.getByRole("button", { name: "Genehmigen" }).click();
    await expect(decide).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Wer fehlt in den nächsten 8 Wochen?" })).toContainText("Lena Lager");

    await page.goto(lenaUrl);
    await expect(page.getByRole("region", { name: /Urlaub \d{4}/ })).toContainText(/Resturlaub\s*27 Tage|27 Tage/);
  });

  test("Überschneidung wird abgelehnt", async () => {
    await page.goto(`${base}/personal/abwesenheiten`);
    const form = page.getByRole("region", { name: "Neuer Antrag" });
    await form.getByLabel("Für").selectOption({ label: "Lena Lager" });
    await form.getByLabel("Von").fill(plus(monday, 1));
    await form.getByLabel("Bis").fill(plus(monday, 1));
    await form.getByRole("button", { name: "Beantragen" }).click();
    await expect(form.getByText("Für diesen Zeitraum gibt es bereits eine Abwesenheit.")).toBeVisible();
  });

  test("Onboarding, eigene Abwesenheitsart, Suche", async () => {
    await page.goto(lenaUrl);
    const onboarding = page.getByRole("region", { name: "Onboarding" });
    await onboarding.getByLabel("Neue Aufgabe").fill("Arbeitskleidung bestellen");
    await onboarding.getByRole("button", { name: "Hinzufügen" }).click();
    await onboarding.getByRole("button", { name: "Arbeitskleidung bestellen erledigen" }).click();
    await expect(onboarding.getByRole("button", { name: "Arbeitskleidung bestellen wieder öffnen" })).toBeVisible();

    await page.goto(`${base}/personal/einstellungen`);
    const types = page.getByRole("region", { name: "Abwesenheitsarten" });
    await types.getByRole("textbox", { name: "Neue Art" }).fill("Elternzeit");
    await types.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(types.getByText("Art „Elternzeit“ angelegt.")).toBeVisible();
    await expectAccessible(page);

    await page.goto(`${base}/suche?q=lager`);
    await page.getByRole("link", { name: /Lena Lager/ }).click();
    await expect(page).toHaveURL(lenaUrl);
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/personal`, lenaUrl, `${base}/personal/abwesenheiten`, `${base}/personal/einstellungen`, `${base}/personal/neu`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Andere Unternehmen sehen keine Personalakte", async ({ browser }) => {
    const other = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await signUpAndConfirm(other, uniqueEmail("personal-fremd"));
    await other.getByLabel("Name des Unternehmens").fill("Fremdwerkstatt");
    await other.getByRole("button", { name: "Weiter" }).click();
    await expect(other.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await other.goto(lenaUrl);
    await expect(other.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  });
});
