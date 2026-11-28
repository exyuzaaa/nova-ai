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

/** Ein fester Tag im nächsten Monat (Mitte), damit Monats- und Wochenansicht stabil sind. */
const nextMonthDay = (day: number) => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day));
  return date.toISOString().slice(0, 10);
};

test.describe("Kalender", () => {
  let page: Page;
  let base = "";
  let eventUrl = "";
  const day = nextMonthDay(10);

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, acceptDownloads: true })).newPage();
    await signUpAndConfirm(page, uniqueEmail("kalender"));
    await page.getByLabel("Name des Unternehmens").fill("Praxis Nord");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;
  });

  test("Kalender ist in der Navigation, Monatsansicht ist barrierefrei", async () => {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: "Kalender", exact: true }).click();
    await expect(page).toHaveURL(`${base}/kalender`);
    await expect(page.getByRole("grid", { name: "Monatsansicht" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Wiederkehrenden Termin anlegen mit Prüfung der Eingaben", async () => {
    await page.goto(`${base}/kalender/neu?datum=${day}`);
    await page.getByLabel("Beginn (Uhrzeit)").fill("10:00");
    await page.getByLabel("Ende (Uhrzeit)").fill("09:00");
    await page.getByRole("button", { name: "Termin anlegen" }).click();
    await expect(page.getByText("Bitte gib einen Titel ein.")).toBeVisible();
    await page.getByLabel("Titel").fill("Teamrunde");
    await page.getByRole("button", { name: "Termin anlegen" }).click();
    await expect(page.getByText("Das Ende muss nach dem Beginn liegen.")).toBeVisible();

    await page.getByLabel("Ende (Uhrzeit)").fill("10:30");
    await page.getByLabel("Ort").fill("Besprechungsraum");
    await page.getByLabel("Wiederholen").selectOption("weekly");
    await page.getByLabel("Ende der Serie").selectOption("count");
    await page.getByLabel("Anzahl Termine").fill("4");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Termin anlegen" }).click();

    await expect(page.getByRole("heading", { name: "Teamrunde", level: 1 })).toBeVisible();
    await expect(page.getByText("Wöchentlich · 4-mal")).toBeVisible();
    await expect(page.getByText(/10:00–10:30 Uhr/)).toBeVisible();
    eventUrl = new URL(page.url()).pathname;
    await expectAccessible(page);
  });

  test("Serie erscheint in Monats- und Listenansicht; ein Termin lässt sich streichen", async () => {
    await page.goto(`${base}/kalender?ansicht=liste&datum=${day}`);
    const links = page.getByRole("link", { name: /Teamrunde/ });
    await expect(links).toHaveCount(4);

    await links.nth(1).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Nur diesen Termin streichen" }).click();
    await expect(async () => {
      await page.goto(`${base}/kalender?ansicht=liste&datum=${day}`);
      await expect(page.getByRole("link", { name: /Teamrunde/ })).toHaveCount(3, { timeout: 1000 });
    }).toPass();
    await page.goto(`${base}/kalender?ansicht=monat&datum=${day}`);
    await expect(page.getByRole("grid", { name: "Monatsansicht" }).getByRole("link", { name: /Teamrunde/ }).first()).toBeVisible();
  });

  test("Mehrtägiger ganztägiger Termin im Unternehmenskalender, auffindbar in der Suche", async () => {
    await page.goto(`${base}/kalender/neu?datum=${nextMonthDay(14)}`);
    await page.getByLabel("Titel").fill("Betriebsurlaub");
    await page.getByLabel("Kalender").selectOption({ label: "Unternehmen (Unternehmen)" });
    await page.getByLabel("Ganztägig").check();
    await page.getByLabel("Letzter Tag").fill(nextMonthDay(16));
    await page.getByRole("button", { name: "Termin anlegen" }).click();
    await expect(page.getByText(/bis .* · ganztägig/)).toBeVisible();

    await page.goto(`${base}/kalender?ansicht=woche&datum=${nextMonthDay(14)}`);
    await expect(page.getByRole("link", { name: "Betriebsurlaub" })).toHaveCount(3);
    await expectAccessible(page);

    await page.goto(`${base}/suche?q=betriebsurlaub`);
    await expect(page.getByRole("link", { name: /Betriebsurlaub/ })).toBeVisible();
  });

  test("Termin bearbeiten und als .ics herunterladen", async () => {
    await page.goto(eventUrl);
    const form = page.getByRole("region", { name: "Serie bearbeiten" });
    await form.getByLabel("Titel").fill("Teamrunde (neu)");
    await form.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(form.getByText("Termin gespeichert.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teamrunde (neu)", level: 1 })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Als .ics herunterladen" }).click();
    const download = await downloadPromise;
    const { readFile } = await import("node:fs/promises");
    const ics = await readFile((await download.path())!, "utf8");
    expect(ics).toContain("SUMMARY:Teamrunde (neu)");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=4");
    expect(ics).toContain("EXDATE:");
  });

  test("Abo-Link liefert die Termine und lässt sich widerrufen", async () => {
    await page.goto(`${base}/kalender`);
    await page.getByRole("link", { name: "Abonnieren" }).click();
    await page.getByRole("button", { name: "Abo-Link erstellen" }).click();
    const link = (await page.locator("code").textContent())!.trim();
    expect(link).toMatch(/\/api\/kalender\/[0-9a-f]{48}$/);
    await expectAccessible(page);

    const feed = await page.request.get(link);
    expect(feed.status()).toBe(200);
    expect(feed.headers()["content-type"]).toContain("text/calendar");
    const body = await feed.text();
    expect(body).toContain("SUMMARY:Teamrunde (neu)");
    expect(body).toContain("SUMMARY:Betriebsurlaub");

    await page.getByRole("button", { name: "Link widerrufen" }).click();
    await expect(page.getByText("Abo-Link widerrufen.")).toBeVisible();
    const revoked = await (await page.request.get(link)).text();
    expect(revoked).not.toContain("SUMMARY:");
  });

  test("Fällige Projektaufgaben erscheinen im Kalender", async () => {
    await page.goto(`${base}/projekte/neu`);
    await page.getByLabel("Name", { exact: true }).fill("Umbau Empfang");
    await page.getByRole("button", { name: "Projekt anlegen" }).click();
    await page.getByLabel("Neue Aufgabe").fill("Möbel bestellen");
    await page.getByRole("button", { name: "Hinzufügen" }).click();
    await page.getByRole("link", { name: "Möbel bestellen" }).click();
    const form = page.getByRole("region", { name: "Aufgabe bearbeiten" });
    await form.getByLabel("Zuständig").selectOption({ index: 1 });
    await form.getByLabel("Fällig am").fill(day);
    await form.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(form.getByText("Aufgabe gespeichert.")).toBeVisible();

    await page.goto(`${base}/kalender?ansicht=woche&datum=${day}`);
    await page.getByRole("link", { name: "Fällig: Möbel bestellen" }).click();
    await expect(page.getByRole("heading", { name: /Möbel bestellen/, level: 2 })).toBeVisible();
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/kalender?datum=${day}`, `${base}/kalender?ansicht=woche&datum=${day}`, `${base}/kalender/neu`, eventUrl, `${base}/kalender/abo`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Andere Unternehmen sehen den Termin nicht", async ({ browser }) => {
    const other = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await signUpAndConfirm(other, uniqueEmail("kalender-fremd"));
    await other.getByLabel("Name des Unternehmens").fill("Fremdpraxis");
    await other.getByRole("button", { name: "Weiter" }).click();
    await expect(other.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await other.goto(eventUrl);
    await expect(other.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  });
});
