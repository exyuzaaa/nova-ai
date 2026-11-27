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

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

test.describe("Projekte: Zeiterfassung, Zeitleiste, Vorlagen", () => {
  let page: Page;
  let base = "";
  let projectUrl = "";

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await signUpAndConfirm(page, uniqueEmail("zeiten"));
    await page.getByLabel("Name des Unternehmens").fill("Studio Süd");
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app\/[a-z0-9-]+$/);
    base = new URL(page.url()).pathname;

    await page.goto(`${base}/projekte/neu`);
    await page.getByLabel("Name", { exact: true }).fill("Messestand 2027");
    await page.getByLabel("Start").fill("2027-01-04");
    await page.getByLabel("Ende").fill("2027-02-26");
    await page.getByLabel("Budget in Stunden").fill("10");
    await page.getByRole("button", { name: "Projekt anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Messestand 2027", level: 1 })).toBeVisible();
    projectUrl = new URL(page.url()).pathname;
    for (const title of ["Standplan", "Grafiken"]) {
      await page.getByLabel("Neue Aufgabe").fill(title);
      await page.getByRole("button", { name: "Hinzufügen" }).click();
      await expect(page.getByRole("link", { name: title })).toBeVisible();
    }
  });

  test("Stoppuhr auf einer Aufgabe starten und unter „Meine Zeiten“ stoppen", async () => {
    await page.getByRole("link", { name: "Standplan" }).click();
    const time = page.getByRole("region", { name: "Zeit" });
    await time.getByLabel("Woran arbeitest du?").fill("Skizzen");
    await time.getByRole("button", { name: "Stoppuhr für diese Aufgabe" }).click();
    await expect(time.getByText(/Läuft seit/)).toContainText("Messestand 2027 · Standplan");
    await expectAccessible(page);

    await page.goto(`${base}/projekte`);
    await page.getByRole("link", { name: "Meine Zeiten" }).click();
    await expect(page.getByRole("heading", { name: "Meine Zeiten", level: 1 })).toBeVisible();
    const timer = page.getByRole("region", { name: "Stoppuhr" });
    await expect(timer.getByText(/Läuft seit/)).toBeVisible();
    await timer.getByRole("button", { name: "Stoppen" }).click();
    await expect(timer.getByText(/Läuft seit/)).toHaveCount(0);
    const entries = page.getByRole("region", { name: "Einträge" });
    await expect(entries.getByText("0:01 h").first()).toBeVisible();
    await expect(entries.getByRole("link", { name: "#1 Standplan" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Zeit nachtragen mit Prüfung, ändern und löschen", async () => {
    await page.goto(projectUrl);
    await page.getByRole("navigation", { name: "Projektbereiche" }).getByRole("link", { name: "Zeiten" }).click();
    const form = page.getByRole("region", { name: "Zeit nachtragen" });
    await form.getByLabel("Beginn").fill("09:00");
    await form.getByLabel("Ende").fill("08:00");
    await form.getByRole("button", { name: "Zeit eintragen" }).click();
    await expect(form.getByText("Das Ende muss nach dem Beginn liegen.")).toBeVisible();

    await form.getByLabel("Ende").fill("");
    await form.getByLabel("oder Dauer").fill("2,5");
    await form.getByLabel("Aufgabe").selectOption({ label: "#2 Grafiken" });
    await form.getByLabel("Notiz").fill("Entwürfe");
    await form.getByRole("button", { name: "Zeit eintragen" }).click();
    await expect(form.getByText("Zeit gespeichert.")).toBeVisible();

    const entries = page.getByRole("region", { name: "Einträge" });
    const entry = entries.getByRole("listitem").filter({ hasText: "Entwürfe" });
    await expect(entry).toContainText("09:00–11:30");
    await expect(entry).toContainText("2:30 h");
    await expect(page.getByText("% verbraucht")).toBeVisible();
    await expect(page.getByRole("region", { name: "Auswertung des Monats" })).toContainText("#2 Grafiken");

    await entry.getByText("Bearbeiten").click();
    await entry.getByLabel("Ende").fill("10:00");
    await entry.getByLabel("oder Dauer").fill("");
    await entry.getByRole("button", { name: "Speichern" }).click();
    await expect(entries.getByRole("listitem").filter({ hasText: "Entwürfe" })).toContainText("1:00 h");
    await expectAccessible(page);

    page.once("dialog", (dialog) => dialog.accept());
    await entries.getByRole("listitem").filter({ hasText: "Entwürfe" }).getByRole("button", { name: /löschen/ }).click();
    await expect(entries.getByText("Entwürfe")).toHaveCount(0);
  });

  test("Zeitleiste zeigt geplante Aufgaben und Meilensteine", async () => {
    await page.goto(`${projectUrl}/zeitleiste`);
    await expect(page.getByText("Noch nichts geplant")).toBeVisible();

    await page.goto(projectUrl);
    await page.getByRole("link", { name: "Standplan" }).click();
    const form = page.getByRole("region", { name: "Aufgabe bearbeiten" });
    await form.getByLabel("Start").fill("2027-01-11");
    await form.getByLabel("Fällig am").fill("2027-01-22");
    await form.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(form.getByText("Aufgabe gespeichert.")).toBeVisible();

    await page.goto(`${projectUrl}/meilensteine`);
    const milestone = page.getByRole("region", { name: "Neuer Meilenstein" });
    await milestone.getByLabel("Name des Meilensteins").fill("Messe");
    await milestone.getByLabel("Fällig am").fill("2027-02-26");
    await milestone.getByRole("button", { name: "Meilenstein anlegen" }).click();
    await expect(page.getByRole("listitem", { name: "Meilenstein Messe" })).toBeVisible();

    await page.getByRole("navigation", { name: "Projektbereiche" }).getByRole("link", { name: "Zeitleiste" }).click();
    const timeline = page.getByRole("table", { name: "Zeitleiste" });
    await expect(timeline.getByRole("row").filter({ hasText: "#1 Standplan" })).toContainText("fällig 22.01.2027");
    await expect(timeline.getByRole("row").filter({ hasText: "◆ Messe" })).toBeVisible();
    await expect(page.getByText("1 Aufgaben ohne Termin sind nicht dargestellt")).toBeVisible();
    await expectAccessible(page);
  });

  test("Als Vorlage speichern und neues Projekt daraus anlegen", async () => {
    await page.goto(`${projectUrl}/einstellungen`);
    const save = page.getByRole("region", { name: "Als Vorlage speichern" });
    await expect(save.getByLabel("Name der Vorlage")).toHaveValue("Vorlage: Messestand 2027");
    await save.getByRole("button", { name: "Vorlage speichern" }).click();
    await expect(page.getByRole("heading", { name: "Vorlage: Messestand 2027", level: 1 })).toBeVisible();
    await expect(page.getByText("Vorlage", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Projektbereiche" }).getByRole("link", { name: "Zeiten" })).toHaveCount(0);

    await page.goto(`${base}/projekte`);
    await expect(page.getByRole("link", { name: /Vorlage: Messestand/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Vorlagen" }).click();
    const template = page.getByRole("listitem", { name: "Vorlage Vorlage: Messestand 2027" });
    await expect(template).toContainText("2 Aufgaben");
    await expectAccessible(page);

    await page.goto(`${base}/projekte/neu`);
    const fromTemplate = page.getByRole("region", { name: "Aus Vorlage" });
    await fromTemplate.getByLabel("Vorlage").selectOption({ label: "Vorlage: Messestand 2027 (2 Aufgaben)" });
    await fromTemplate.getByLabel("Name des Projekts").fill("Messestand 2028");
    await fromTemplate.getByLabel("Startdatum").fill("2028-01-03");
    await fromTemplate.getByRole("button", { name: "Projekt aus Vorlage anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Messestand 2028", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Standplan" })).toBeVisible();
    await page.getByRole("link", { name: "Standplan" }).click();
    await expect(page.getByRole("region", { name: "Aufgabe bearbeiten" }).getByLabel("Fällig am")).toHaveValue("2028-01-21");
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/projekte/zeiten`, `${projectUrl}/zeiten`, `${projectUrl}/zeitleiste`, `${base}/projekte/vorlagen`, `${base}/projekte/neu`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Wochenansicht wechselt die Woche", async () => {
    await page.goto(`${base}/projekte/zeiten`);
    await page.getByRole("link", { name: "← Vorherige Woche" }).click();
    await expect(page.getByText("Keine Zeiten in dieser Woche")).toBeVisible();
    await page.getByRole("link", { name: "Diese Woche" }).click();
    await expect(page.getByRole("region", { name: "Einträge" }).getByText("0:01 h").first()).toBeVisible();
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
