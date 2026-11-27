import { expect, type Page } from "@playwright/test";
import { waitForAuthLink } from "./mailpit";

export const TEST_PASSWORD = "Sicher-Test-2026";

/** Registriert ein Konto über die Oberfläche und bestätigt es über den Link aus der E-Mail. */
export const signUpAndConfirm = async (page: Page, email: string, password = TEST_PASSWORD, startUrl = "/registrieren") => {
  await page.goto(startUrl);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Postfach prüfen" })).toBeVisible();
  const link = await waitForAuthLink(email, "bestätige");
  await page.goto(link);
};

export const logIn = async (page: Page, email: string, password = TEST_PASSWORD) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
};

/** Anmelden und warten, bis die Weiterleitung nach dem Login abgeschlossen ist. */
export const logInAndWait = async (page: Page, email: string, password = TEST_PASSWORD) => {
  await logIn(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
};

/** Unternehmen und erste Website im Onboarding anlegen; gibt die Website-ID zurück. */
export const completeOnboarding = async (page: Page, organization: string, website: string, domain: string) => {
  await expect(page.getByRole("heading", { name: "Unternehmen anlegen" })).toBeVisible();
  await page.getByLabel("Name des Unternehmens").fill(organization);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
  await page.getByLabel("Name der Website").fill(website);
  await page.getByLabel("Domain").fill(domain);
  await page.getByRole("button", { name: "Website hinzufügen" }).click();
  await expect(page).toHaveURL(/\/analytics\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() as string;
};
