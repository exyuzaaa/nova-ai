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

test.describe("Projekte: Aufgaben, Board, Meilensteine, Einstellungen", () => {
  let page: Page;
  let base = "";
  let projectUrl = "";
  let taskUrl = "";

  test.beforeAll(async ({ browser }) => {
    ({ page, base } = await newTenant(browser, "projekte", "Agentur Nord"));
  });

  test("Projekt anlegen mit Prüfung der Eingaben", async () => {
    await page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: "Projekte", exact: true }).click();
    await expect(page).toHaveURL(`${base}/projekte`);
    await expect(page.getByText("Noch keine Projekte")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Neues Projekt" }).click();
    await page.getByLabel("Start").fill("2026-12-10");
    await page.getByLabel("Ende").fill("2026-12-01");
    await page.getByLabel("Budget in Stunden").fill("viel");
    await page.getByRole("button", { name: "Projekt anlegen" }).click();
    await expect(page.getByText("Bitte gib einen Namen ein.")).toBeVisible();
    await expect(page.getByText("Bitte gib die Stunden als Zahl ein, z. B. 12,5.")).toBeVisible();
    await expectAccessible(page);

    await page.getByLabel("Name", { exact: true }).fill("Website-Relaunch");
    await page.getByLabel("Budget in Stunden").fill("40");
    await page.getByRole("button", { name: "Projekt anlegen" }).click();
    await expect(page.getByText("Das Enddatum liegt vor dem Startdatum.")).toBeVisible();
    await page.getByLabel("Ende").fill("2026-12-31");
    await page.getByRole("button", { name: "Projekt anlegen" }).click();
    await expect(page.getByRole("heading", { name: "Website-Relaunch", level: 1 })).toBeVisible();
    await expect(page.getByText("P-00001")).toBeVisible();
    projectUrl = new URL(page.url()).pathname;
  });

  test("Aufgaben anlegen, abhaken und filtern", async () => {
    for (const title of ["Startseite entwerfen", "Texte schreiben", "Impressum prüfen"]) {
      await page.getByLabel("Neue Aufgabe").fill(title);
      await page.getByRole("button", { name: "Hinzufügen" }).click();
      await expect(page.getByRole("link", { name: title })).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Offen (3)" })).toBeVisible();

    await page.getByRole("checkbox", { name: "Impressum prüfen erledigen" }).click();
    await expect(page.getByRole("link", { name: "Impressum prüfen" })).toHaveCount(0);
    await page.getByLabel("Erledigte zeigen").check();
    await page.getByRole("button", { name: "Filtern" }).click();
    await expect(page.getByRole("checkbox", { name: "Impressum prüfen wieder öffnen" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Erledigt (1)" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Board: Aufgabe in einen anderen Status verschieben", async () => {
    await page.getByRole("navigation", { name: "Projektbereiche" }).getByRole("link", { name: "Board" }).click();
    const card = page.getByRole("listitem", { name: "Status Offen" }).getByRole("listitem").filter({ hasText: "Texte schreiben" });
    await card.getByLabel("Status von Texte schreiben").selectOption({ label: "In Arbeit" });
    await card.getByRole("button", { name: "Texte schreiben in gewählten Status verschieben" }).click();
    await expect(page.getByRole("listitem", { name: "Status In Arbeit" }).getByRole("link", { name: "Texte schreiben" })).toBeVisible();

    const review = page.getByRole("listitem", { name: "Status Prüfung" });
    await review.getByLabel("Neue Aufgabe in Prüfung").fill("Freigabe einholen");
    await review.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(review.getByRole("link", { name: "Freigabe einholen" })).toBeVisible();
    await expectAccessible(page);
  });

  test("Aufgabe bearbeiten: Details, Unteraufgaben, Checkliste, Abhängigkeit, Kommentare", async () => {
    await page.goto(projectUrl);
    await page.getByRole("link", { name: "Startseite entwerfen" }).click();
    await expect(page.getByRole("heading", { name: /Startseite entwerfen/, level: 2 })).toBeVisible();
    taskUrl = new URL(page.url()).pathname;

    const form = page.getByRole("region", { name: "Aufgabe bearbeiten" });
    await form.getByLabel("Priorität").selectOption("high");
    await form.getByLabel("Zuständig").selectOption({ index: 1 });
    await form.getByLabel("Fällig am").fill("2026-12-05");
    await form.getByLabel("Geschätzter Aufwand").fill("1:30");
    await form.getByLabel("Beschreibung").fill("Drei Varianten für die Startseite.");
    await form.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(form.getByText("Aufgabe gespeichert.")).toBeVisible();
    await expect(page.getByText("geschätzt 1:30 h")).toBeVisible();

    await page.getByLabel("Neue Unteraufgabe").fill("Farben festlegen");
    await page.getByRole("button", { name: "Hinzufügen" }).first().click();
    await expect(page.getByRole("region", { name: "Unteraufgaben (0/1)" }).getByRole("link", { name: "Farben festlegen" })).toBeVisible();

    const checklist = page.getByRole("region", { name: "Checkliste" });
    await checklist.getByLabel("Neuer Punkt").fill("Logo einbauen");
    await checklist.getByRole("button", { name: "Hinzufügen" }).click();
    await checklist.getByRole("button", { name: "Logo einbauen abhaken" }).click();
    await expect(checklist.getByText("1 von 1 erledigt")).toBeVisible();

    const dependencies = page.getByRole("region", { name: "Abhängigkeiten" });
    await dependencies.getByLabel("Wartet auf Aufgabe").selectOption({ label: "#2 Texte schreiben" });
    await dependencies.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(page.getByText("Wartet noch auf eine Aufgabe.")).toBeVisible();

    const comments = page.getByRole("region", { name: /Kommentare/ });
    await comments.getByLabel("Kommentar").fill("Entwurf A gefällt mir am besten.");
    await comments.getByRole("button", { name: "Kommentieren" }).click();
    const comment = comments.getByRole("listitem").filter({ hasText: "Entwurf A" });
    await expect(comment).toBeVisible();
    await comment.getByRole("button", { name: "Bearbeiten" }).click();
    await comment.getByLabel("Kommentar bearbeiten").fill("Entwurf B gefällt mir am besten.");
    await comment.getByRole("button", { name: "Speichern" }).click();
    await expect(comments.getByText("Entwurf B gefällt mir am besten.")).toBeVisible();
    await expect(comments.getByText("(bearbeitet)")).toBeVisible();
    await expectAccessible(page);

    // Die abhängige Aufgabe zeigt, was sie blockiert
    await dependencies.getByRole("link", { name: "#2 Texte schreiben" }).click();
    await expect(page.getByRole("region", { name: "Abhängigkeiten" }).getByText("Blockiert")).toBeVisible();
  });

  test("Kreisabhängigkeit wird verhindert", async () => {
    const dependencies = page.getByRole("region", { name: "Abhängigkeiten" });
    await dependencies.getByLabel("Wartet auf Aufgabe").selectOption({ label: "#1 Startseite entwerfen" });
    await dependencies.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(dependencies.getByText("Diese Abhängigkeit würde einen Kreis bilden.")).toBeVisible();
  });

  test("Meilenstein anlegen, Aufgabe zuordnen, als erreicht markieren", async () => {
    await page.goto(`${projectUrl}/meilensteine`);
    await expect(page.getByText("Noch keine Meilensteine")).toBeVisible();
    const create = page.getByRole("region", { name: "Neuer Meilenstein" });
    await create.getByLabel("Name des Meilensteins").fill("Entwurf freigegeben");
    await create.getByLabel("Fällig am").fill("2026-12-15");
    await create.getByRole("button", { name: "Meilenstein anlegen" }).click();
    await expect(page.getByRole("listitem", { name: "Meilenstein Entwurf freigegeben" })).toBeVisible();

    await page.goto(taskUrl);
    const form = page.getByRole("region", { name: "Aufgabe bearbeiten" });
    await form.getByLabel("Meilenstein").selectOption({ label: "Entwurf freigegeben" });
    await form.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(form.getByText("Aufgabe gespeichert.")).toBeVisible();

    await page.goto(`${projectUrl}/meilensteine`);
    const milestone = page.getByRole("listitem", { name: "Meilenstein Entwurf freigegeben" });
    await expect(milestone.getByText("0 von 1 Aufgaben erledigt (0 %)")).toBeVisible();
    await milestone.getByRole("button", { name: "Als erreicht markieren" }).click();
    await expect(milestone.getByText("Erreicht")).toBeVisible();
    await expectAccessible(page);
  });

  test("Einstellungen: Status ergänzen, geschützte Status, Archiv ist schreibgeschützt", async () => {
    await page.getByRole("navigation", { name: "Projektbereiche" }).getByRole("link", { name: "Einstellungen" }).click();
    const statuses = page.getByRole("region", { name: "Status und Board-Spalten" });
    await statuses.getByLabel("Neuer Status").fill("Freigabe Kunde");
    await statuses.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(statuses.getByRole("listitem", { name: "Status Freigabe Kunde" })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await statuses.getByRole("button", { name: "Status In Arbeit löschen" }).click();
    await expect(statuses.getByText("In diesem Status liegen noch Aufgaben. Verschiebe sie zuerst.")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await statuses.getByRole("button", { name: "Status Erledigt löschen" }).click();
    await expect(statuses.getByText("Ein Projekt braucht mindestens einen Status „Erledigt“.")).toBeVisible();

    await expect(page.getByRole("region", { name: "Projektteam" }).getByText("Projektleitung")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Archivieren" }).click();
    await expect(page.getByText("Archiviert – schreibgeschützt")).toBeVisible();
    await page.goto(projectUrl);
    await expect(page.getByLabel("Neue Aufgabe")).toHaveCount(0);
    await page.goto(`${projectUrl}/einstellungen`);
    await page.getByRole("button", { name: "Wiederherstellen" }).click();
    await expect(page.getByText("Archiviert – schreibgeschützt")).toHaveCount(0);
  });

  test("Liste zeigt Fortschritt; globale Suche findet Aufgaben", async () => {
    await page.goto(`${base}/projekte`);
    const card = page.getByRole("link", { name: "Website-Relaunch (P-00001)" });
    await expect(card).toContainText("1 von 4 Aufgaben");
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");

    await page.goto(`${base}/suche?q=startseite`);
    await page.getByRole("link", { name: /Startseite entwerfen/ }).click();
    await expect(page).toHaveURL(taskUrl);
  });

  test("Mobil ohne horizontales Scrollen", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [`${base}/projekte`, projectUrl, `${projectUrl}/board`, taskUrl, `${projectUrl}/meilensteine`, `${projectUrl}/einstellungen`]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      const offenders = await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${(el as HTMLElement).className.toString().slice(0, 80)} ${Math.round(el.getBoundingClientRect().right)}`),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${path} ${offenders.join(" | ")}`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Andere Unternehmen sehen keine Projekte", async ({ browser }) => {
    const other = await newTenant(browser, "projekte-fremd", "Fremdagentur");
    await other.page.goto(projectUrl);
    await expect(other.page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await other.page.goto(projectUrl.replace(base, other.base));
    await expect(other.page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    await other.page.goto(`${other.base}/suche?q=startseite`);
    await expect(other.page.getByText("Keine Treffer")).toBeVisible();
  });
});
