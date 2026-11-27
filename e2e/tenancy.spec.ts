import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { completeOnboarding, logInAndWait, signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const newPage = async (browser: Browser): Promise<Page> =>
  (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("Unternehmen, Rollen und Mandantentrennung", () => {
  const ownerEmail = uniqueEmail("org-owner");
  const memberEmail = uniqueEmail("org-member");
  const outsiderEmail = uniqueEmail("outsider");
  let siteId = "";
  let tenantPath = "";
  let invitationLink = "";

  test("Owner richtet Unternehmen ein und lädt ein Mitglied ein", async ({ browser }) => {
    const owner = await newPage(browser);
    await signUpAndConfirm(owner, ownerEmail);
    siteId = await completeOnboarding(owner, "Agentur Nord", "Kundenportal", "kundenportal.example.de");

    await owner.goto("/app");
    await expect(owner).toHaveURL(/\/app\/agentur-nord(-[a-f0-9]{6})?$/);
    tenantPath = new URL(owner.url()).pathname;

    await owner.getByRole("link", { name: "Mitglieder", exact: true }).first().click();
    await expect(owner).toHaveURL(`${tenantPath}/verwaltung/mitglieder`);
    const inviteSection = owner.getByRole("region", { name: "Mitglieder einladen" });
    await inviteSection.getByLabel("E-Mail-Adresse").fill(memberEmail);
    await inviteSection.getByLabel("Rolle").selectOption("viewer");
    await inviteSection.getByRole("button", { name: "Einladen" }).click();
    const link = owner.getByTestId("invitation-link");
    await expect(link).toContainText("/einladung/");
    invitationLink = (await link.textContent()) ?? "";
    await expect(owner.getByText("Offene Einladungen")).toBeVisible();

    const results = await new AxeBuilder({ page: owner }).withTags(WCAG).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);

    // Mobil: kein horizontales Scrollen
    await owner.setViewportSize({ width: 390, height: 844 });
    await owner.reload();
    await expect(owner.getByRole("heading", { name: "Mitglieder", level: 1 })).toBeVisible();
    expect(await owner.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("Fremde Person kann die Einladung nicht annehmen", async ({ browser }) => {
    const outsider = await newPage(browser);
    await signUpAndConfirm(outsider, outsiderEmail);
    await outsider.goto(invitationLink);
    await expect(outsider.getByRole("alert").filter({ hasText: `gilt für ${memberEmail}` })).toBeVisible();
    await expect(outsider.getByRole("button", { name: "Einladung annehmen" })).toHaveCount(0);
  });

  test("Eingeladene Person registriert sich über den Link und tritt als Betrachter bei", async ({ browser }) => {
    const member = await newPage(browser);
    await member.goto(invitationLink);
    await member.getByRole("link", { name: "Konto erstellen" }).click();
    await expect(member).toHaveURL(/\/registrieren\?next=/);
    await signUpAndConfirm(member, memberEmail, undefined, member.url());

    await expect(member.getByRole("heading", { name: "Einladung zu „Agentur Nord“" })).toBeVisible();
    await member.getByRole("button", { name: "Einladung annehmen" }).click();
    await expect(member).toHaveURL(tenantPath);

    await member.goto(`${tenantPath}/verwaltung`);
    await expect(member.getByRole("textbox", { name: "Anzeigename" })).toBeDisabled();
    await member.goto(`${tenantPath}/verwaltung/mitglieder`);
    await expect(member.getByRole("region", { name: "Mitglieder einladen" })).toHaveCount(0);
    await expect(member.getByRole("region", { name: "Mitglieder", exact: true })).toContainText(ownerEmail);
    await expect(member.getByRole("combobox", { name: /Rolle von/ })).toHaveCount(0);
    // Betrachter sehen kein Protokoll
    await member.goto(`${tenantPath}/verwaltung/protokoll`);
    await expect(member.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
    // Analytics ist als Betrachter lesbar
    await member.goto(`/analytics/${siteId}`);
    await expect(member.getByRole("heading", { name: /Noch keine Daten/ })).toBeVisible();
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
    await owner.goto(`${tenantPath}/verwaltung/mitglieder`);
    await owner.getByRole("combobox", { name: `Rolle von ${memberEmail}` }).selectOption("admin");
    await owner.getByRole("button", { name: `Rolle von ${memberEmail} speichern` }).click();
    await expect(owner.getByText("Rolle geändert.")).toBeVisible();

    const member = await newPage(browser);
    await logInAndWait(member, memberEmail);
    await member.goto(`${tenantPath}/verwaltung/mitglieder`);
    await expect(member.getByRole("region", { name: "Mitglieder einladen" })).toBeVisible();
    // Administratoren dürfen keine Owner ernennen
    await expect(member.getByRole("region", { name: "Mitglieder einladen" }).getByRole("option", { name: "Owner" })).toHaveCount(0);
    await member.goto(`${tenantPath}/verwaltung`);
    await expect(member.getByRole("textbox", { name: "Anzeigename" })).toBeEnabled();
  });

  test("Andere Unternehmen sehen weder Website noch Verwaltung", async ({ browser }) => {
    const outsider = await newPage(browser);
    await logInAndWait(outsider, outsiderEmail);
    await expect(outsider).toHaveURL(/\/onboarding/);

    for (const path of [
      `/analytics/${siteId}`,
      `/analytics/${siteId}/settings`,
      tenantPath,
      `${tenantPath}/verwaltung/mitglieder`,
      `${tenantPath}/analytics`,
    ]) {
      await outsider.goto(path);
      await expect(outsider.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
      await expect(outsider.getByText("Kundenportal")).toHaveCount(0);
      await expect(outsider.getByText(ownerEmail)).toHaveCount(0);
    }
  });
});
