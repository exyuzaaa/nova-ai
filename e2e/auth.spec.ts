import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { completeOnboarding, logIn, signUpAndConfirm, TEST_PASSWORD } from "./support/auth";
import { uniqueEmail, waitForAuthLink } from "./support/mailpit";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentifizierung (Supabase Auth)", () => {
  test("schützt Analytics und leitet nach der Anmeldung zurück", async ({ page }) => {
    await page.goto("/analytics/demo");
    await expect(page).toHaveURL(/\/login\?next=%2Fanalytics%2Fdemo/);
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  });

  test("Registrierung mit E-Mail-Bestätigung, Einrichtung, An- und Abmeldung", async ({ page }) => {
    const email = uniqueEmail("owner");

    // Ohne Bestätigung keine Anmeldung
    await page.goto("/registrieren");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill("zukurz");
    await page.getByRole("button", { name: "Konto erstellen" }).click();
    await expect(page.getByText("mindestens 10 Zeichen")).toBeVisible();

    await signUpAndConfirm(page, email);
    const siteId = await completeOnboarding(page, "Müller & Söhne GmbH", "Unternehmenswebsite", "https://www.mueller-soehne.de/kontakt");

    await expect(page.getByRole("heading", { name: "Noch keine Daten für Unternehmenswebsite" })).toBeVisible();
    await page.getByRole("link", { name: "Einstellungen" }).first().click();
    await expect(page).toHaveURL(`/analytics/${siteId}/settings`);
    await expect(page.getByRole("textbox", { name: "Domain" })).toHaveValue("mueller-soehne.de");
    await expect(page.getByTestId("public-site-id")).toHaveText(/^ns_[a-f0-9]{16}$/);

    await page.getByRole("button", { name: "Abmelden" }).first().click();
    await expect(page).toHaveURL(/\/login\?hinweis=abgemeldet/);
    await expect(page.getByText("Du wurdest abgemeldet.")).toBeVisible();

    await logIn(page, email, "Falsches-Passwort-1");
    await expect(page.getByRole("alert").filter({ hasText: "E-Mail-Adresse oder Passwort ist falsch" })).toBeVisible();

    // Nach der Anmeldung landet man in der NOVA-Übersicht des Unternehmens
    await logIn(page, email);
    await expect(page).toHaveURL(/\/app\/mueller-soehne-gmbh(-[a-f0-9]{6})?$/);
    await expect(page.getByRole("heading", { name: "Müller & Söhne GmbH" })).toBeVisible();
    await page.getByRole("link", { name: "Analytics öffnen" }).click();
    await expect(page).toHaveURL(`/analytics/${siteId}`);
  });

  test("Passwort zurücksetzen per E-Mail-Link", async ({ page }) => {
    const email = uniqueEmail("reset");
    await signUpAndConfirm(page, email);
    await page.context().clearCookies();

    await page.goto("/passwort-vergessen");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByRole("button", { name: "Link senden" }).click();
    await expect(page.getByRole("status")).toContainText("Wenn ein Konto zu dieser Adresse existiert");

    const link = await waitForAuthLink(email, "Passwort");
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Neues Passwort festlegen" })).toBeVisible();
    await page.getByLabel("Neues Passwort").fill("Neues-Passwort-2027");
    await page.getByLabel("Passwort wiederholen").fill("Neues-Passwort-2027");
    await page.getByRole("button", { name: "Passwort speichern" }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    await page.context().clearCookies();
    await logIn(page, email, TEST_PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "falsch" })).toBeVisible();
    await logIn(page, email, "Neues-Passwort-2027");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("verrät nicht, ob ein Konto existiert", async ({ page }) => {
    await page.goto("/passwort-vergessen");
    await page.getByLabel("E-Mail-Adresse").fill(uniqueEmail("gibt-es-nicht"));
    await page.getByRole("button", { name: "Link senden" }).click();
    await expect(page.getByRole("status")).toContainText("Wenn ein Konto zu dieser Adresse existiert");
  });

  test("ignoriert Weiterleitungen auf fremde Domains", async ({ page }) => {
    const email = uniqueEmail("redirect");
    await signUpAndConfirm(page, email);
    await page.context().clearCookies();
    await page.goto("/login?next=https://boese.example/klau");
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Passwort", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/localhost:3100\/onboarding/);
  });

  test("lehnt ungültige Bestätigungslinks ab", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=manipuliert&type=recovery");
    await expect(page).toHaveURL(/\/login\?fehler=link-ungueltig/);
    await expect(page.getByText("Der Link ist ungültig oder abgelaufen")).toBeVisible();
  });

  for (const path of ["/login", "/registrieren", "/passwort-vergessen"]) {
    test(`ist barrierefrei: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }
});
