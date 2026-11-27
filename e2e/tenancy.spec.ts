import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { completeOnboarding, logInAndWait, signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const newPage = async (browser: Browser): Promise<Page> =>
  (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();

test.describe("Unternehmen, Rollen und Mandantentrennung", () => {
  const ownerEmail = uniqueEmail("org-owner");
  const memberEmail = uniqueEmail("org-member");
  const outsiderEmail = uniqueEmail("outsider");
  let siteId = "";
  let invitationLink = "";

  test("Owner richtet Unternehmen ein und lädt ein Mitglied ein", async ({ browser }) => {
    const owner = await newPage(browser);
    await signUpAndConfirm(owner, ownerEmail);
    siteId = await completeOnboarding(owner, "Agentur Nord", "Kundenportal", "kundenportal.example.de");

    await owner.goto(`/analytics/${siteId}/settings`);
    const inviteSection = owner.getByRole("region", { name: "Mitglieder einladen" });
    await inviteSection.getByLabel("E-Mail-Adresse").fill(memberEmail);
    await inviteSection.getByLabel("Rolle").selectOption("viewer");
    await inviteSection.getByRole("button", { name: "Einladen" }).click();
    const link = owner.getByTestId("invitation-link");
    await expect(link).toContainText("/einladung/");
    invitationLink = (await link.textContent()) ?? "";
    await expect(owner.getByText("Offene Einladungen")).toBeVisible();

    const results = await new AxeBuilder({ page: owner }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);

    // Mobil: kein horizontales Scrollen (Regression: Screenreader-Texte in der Mitgliedertabelle)
    await owner.setViewportSize({ width: 390, height: 844 });
    await owner.reload();
    await expect(owner.getByRole("heading", { name: "Einstellungen" })).toBeVisible();
    expect(await owner.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("Fremde Person kann die Einladung nicht annehmen", async ({ browser }) => {
    const outsider = await newPage(browser);
    await signUpAndConfirm(outsider, outsiderEmail);
    await outsider.goto(invitationLink);
    await expect(outsider.getByRole("alert").filter({ hasText: `gilt für ${memberEmail}` })).toBeVisible();
    await expect(outsider.getByRole("button", { name: "Einladung annehmen" })).toHaveCount(0);
  });

  test("Eingeladene Person registriert sich über den Link und tritt als Viewer bei", async ({ browser }) => {
    const member = await newPage(browser);
    await member.goto(invitationLink);
    await member.getByRole("link", { name: "Konto erstellen" }).click();
    await expect(member).toHaveURL(/\/registrieren\?next=/);
    await signUpAndConfirm(member, memberEmail, undefined, member.url());

    // Nach der Bestätigung zurück zur Einladung
    await expect(member.getByRole("heading", { name: "Einladung zu „Agentur Nord“" })).toBeVisible();
    await member.getByRole("button", { name: "Einladung annehmen" }).click();
    await expect(member).toHaveURL(`/analytics/${siteId}`);

    await member.goto(`/analytics/${siteId}/settings`);
    await expect(member.getByRole("textbox", { name: "Name", exact: true })).toBeDisabled();
    await expect(member.getByRole("region", { name: "Mitglieder einladen" })).toHaveCount(0);
    await expect(member.getByRole("region", { name: "Mitglieder" })).toContainText(ownerEmail);
    await expect(member.getByRole("combobox", { name: /Rolle von/ })).toHaveCount(0);
  });

  test("Einladung ist nur einmal verwendbar", async ({ browser }) => {
    const outsider = await newPage(browser);
    await logInAndWait(outsider, outsiderEmail);
    await outsider.goto(invitationLink);
    await expect(outsider.getByRole("heading", { name: "Einladung nicht verfügbar" })).toBeVisible();
  });

  test("Owner befördert das Mitglied zum Administrator", async ({ browser }) => {
    const owner = await newPage(browser);
    await logInAndWait(owner, ownerEmail);
    await owner.goto(`/analytics/${siteId}/settings`);
    await owner.getByRole("combobox", { name: `Rolle von ${memberEmail}` }).selectOption("admin");
    await owner.getByRole("button", { name: `Rolle von ${memberEmail} speichern` }).click();
    await expect(owner.getByText("Rolle geändert.")).toBeVisible();

    const member = await newPage(browser);
    await logInAndWait(member, memberEmail);
    await member.goto(`/analytics/${siteId}/settings`);
    await expect(member.getByRole("region", { name: "Mitglieder einladen" })).toBeVisible();
    await expect(member.getByRole("textbox", { name: "Name", exact: true })).toBeEnabled();
    // Administratoren dürfen keine Owner ernennen
    await expect(member.getByRole("region", { name: "Mitglieder einladen" }).getByRole("option", { name: "Owner" })).toHaveCount(0);
  });

  test("Andere Unternehmen sehen die Website nicht", async ({ browser }) => {
    const outsider = await newPage(browser);
    await logInAndWait(outsider, outsiderEmail);
    await expect(outsider).toHaveURL(/\/onboarding/);

    for (const path of [`/analytics/${siteId}`, `/analytics/${siteId}/settings`]) {
      await outsider.goto(path);
      await expect(outsider.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
      await expect(outsider.getByText("Kundenportal")).toHaveCount(0);
    }
  });
});
