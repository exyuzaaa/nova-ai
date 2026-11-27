import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { logIn, signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";
import { totp } from "./support/totp";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const newPage = async (browser: Browser): Promise<Page> =>
  (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();

test.describe("Sicherheit: Zwei-Faktor-Anmeldung und Geräte", () => {
  const email = uniqueEmail("mfa");
  let first: Page;
  let second: Page;
  let secret = "";
  let tenantPath = "";

  test("Konto einrichten und Sicherheitsseite aufrufen", async ({ browser }) => {
    first = await newPage(browser);
    await signUpAndConfirm(first, email);
    await first.getByLabel("Name des Unternehmens").fill("Sicher GmbH");
    await first.getByRole("button", { name: "Weiter" }).click();
    await expect(first.getByRole("heading", { name: "Erste Website hinzufügen" })).toBeVisible();
    await first.goto("/app");
    await expect(first).toHaveURL(/\/app\/sicher-gmbh/);
    tenantPath = new URL(first.url()).pathname;

    await first.getByRole("link", { name: "Konto und Sicherheit" }).first().click();
    await expect(first).toHaveURL("/konto/sicherheit");
    await expect(first.getByText("Dieses Gerät")).toBeVisible();
    const results = await new AxeBuilder({ page: first }).withTags(WCAG).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });

  test("Zwei-Faktor einrichten: falscher Code wird abgelehnt, richtiger bestätigt", async () => {
    await first.getByLabel("Name des Geräts (optional)").fill("Testgerät");
    await first.getByRole("button", { name: "Zwei-Faktor einrichten" }).click();
    await expect(first.getByRole("img", { name: "QR-Code für die Authenticator-App" })).toBeVisible();
    secret = (await first.getByTestId("totp-secret").textContent())?.trim() ?? "";
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);

    await first.getByLabel("Code aus der App").fill("000000");
    await first.getByRole("button", { name: "Code bestätigen" }).click();
    await expect(first.getByText("Der Code ist falsch oder abgelaufen")).toBeVisible();

    await first.getByLabel("Code aus der App").fill(totp(secret));
    await first.getByRole("button", { name: "Code bestätigen" }).click();
    await expect(first.getByText("Deine Anmeldung ist mit einem zweiten Faktor geschützt.")).toBeVisible();
    await expect(first.getByText("Mit zweitem Faktor")).toBeVisible();
  });

  test("Anmeldung auf einem zweiten Gerät verlangt den Code", async ({ browser }) => {
    second = await newPage(browser);
    await logIn(second, email);
    await expect(second).toHaveURL(/\/login\/bestaetigen/);

    // Ohne Code keine Unternehmensdaten – auch nicht über direkte Adressen
    await second.goto(tenantPath);
    await expect(second).toHaveURL(/\/login\/bestaetigen/);

    await second.getByLabel("Code aus der App").fill("123456");
    await second.getByRole("button", { name: "Bestätigen" }).click();
    await expect(second.getByText("Der Code ist falsch oder abgelaufen")).toBeVisible();

    await second.getByLabel("Code aus der App").fill(totp(secret));
    await second.getByRole("button", { name: "Bestätigen" }).click();
    await expect(second).toHaveURL(tenantPath);
    await expect(second.getByRole("heading", { name: "Sicher GmbH", level: 1 })).toBeVisible();
  });

  test("Anderes Gerät abmelden: es verliert sofort den Zugriff", async () => {
    await first.goto("/konto/sicherheit");
    const others = first.getByRole("listitem").filter({ hasNot: first.getByText("Dieses Gerät") }).filter({ has: first.getByRole("button", { name: /abmelden$/ }) });
    await expect(others).toHaveCount(1);
    await others.getByRole("button", { name: /abmelden$/ }).click();
    await expect(first.getByRole("button", { name: /abmelden$/ })).toHaveCount(0);

    await second.goto(tenantPath);
    await expect(second).toHaveURL(/\/login\?hinweis=sitzung-beendet/);
    await expect(second.getByText("Diese Sitzung wurde beendet.")).toBeVisible();
  });

  test("Sicherheitsheader werden gesendet", async ({ request }) => {
    const response = await request.get("/login");
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
