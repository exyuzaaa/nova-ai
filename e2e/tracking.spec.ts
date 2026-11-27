import { expect, test } from "@playwright/test";
import { completeOnboarding, signUpAndConfirm } from "./support/auth";
import { uniqueEmail } from "./support/mailpit";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

/** nova.test zeigt per --host-resolver-rules auf den lokalen Server (siehe playwright.config.ts). */
const TEST_HOST = "http://nova.test:3100";
const VISITOR_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

test.describe("Tracking: Skript → Erfassung → Status", () => {
  let siteId = "";
  let publicSiteId = "";
  const ownerEmail = uniqueEmail("tracking-owner");

  test("Owner legt eine Website an und sieht den Einbau-Code", async ({ page }) => {
    await signUpAndConfirm(page, ownerEmail);
    siteId = await completeOnboarding(page, "Tracking GmbH", "Testseite", "nova.test");
    await page.goto(`/analytics/${siteId}/settings`);
    const snippet = page.getByTestId("tracking-snippet");
    await expect(snippet).toContainText('/tracker.js" data-site-id="ns_');
    publicSiteId = (await page.getByTestId("public-site-id").textContent()) ?? "";
    await expect(page.getByTestId("tracking-status")).toContainText("Noch keine Daten empfangen");
  });

  test("Besuch wird erfasst – ohne Cookies und ohne Speicher im Browser", async ({ browser }) => {
    const visitor = await browser.newContext({ userAgent: VISITOR_UA, storageState: { cookies: [], origins: [] } });
    const page = await visitor.newPage();
    // Inhalt von sendBeacon-Anfragen ist in Playwright nicht lesbar – gezählt wird die Anzahl,
    // der Inhalt wird anschließend über den Status in NOVA geprüft.
    const collected: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/e")) collected.push(request.method());
    });

    await page.goto(`${TEST_HOST}/tracking-test?site=${publicSiteId}&utm_source=newsletter&utm_medium=email`);
    await expect(page.getByText(`Tracking aktiv für ${publicSiteId}`)).toBeVisible();
    await expect.poll(() => collected.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Eigenes Event senden" }).click();
    await page.getByRole("button", { name: "Seitenwechsel simulieren" }).click();
    await expect.poll(() => collected.length).toBeGreaterThanOrEqual(3);

    expect(collected.every((method) => method === "POST")).toBe(true);

    expect(await visitor.cookies()).toEqual([]);
    expect(await page.evaluate(() => window.localStorage.length + window.sessionStorage.length)).toBe(0);
    await visitor.close();
  });

  test("Echtzeit-Daten nur für angemeldete Mitglieder", async ({ request }) => {
    expect((await request.get(`/api/analytics/realtime/${siteId}`)).status()).toBe(401);
  });

  test("Bots und fremde Domains werden nicht gezählt", async ({ request }) => {
    const send = (data: object, userAgent = VISITOR_UA) =>
      request.post("/api/e", { data: JSON.stringify(data), headers: { "content-type": "text/plain", "user-agent": userAgent } });
    expect((await send({ s: publicSiteId, t: "pageview", u: "https://boese.example/" })).status()).toBe(202);
    expect((await send({ s: publicSiteId, t: "pageview", u: "http://nova.test/" }, "Googlebot/2.1 (+http://www.google.com/bot.html)")).status()).toBe(202);
    expect((await send({ kaputt: true })).status()).toBe(202);
  });

  test("Einstellungen und Dashboard zeigen die erfassten Daten", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-Mail-Adresse").fill(ownerEmail);
    await page.getByLabel("Passwort", { exact: true }).fill("Sicher-Test-2026");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(page).toHaveURL(/\/app\/tracking-gmbh/);
    await page.goto(`/analytics/${siteId}`);

    // Dashboard mit echten Daten (Phase 5)
    const kpiValue = (label: string) =>
      page.getByRole("button", { name: label, exact: true }).locator("xpath=..").locator("p").first();
    await expect(kpiValue("Eindeutige Besucher")).toHaveText("1");
    await expect(kpiValue("Sessions")).toHaveText("1");
    await expect(kpiValue("Seitenaufrufe")).toHaveText("2");
    await expect(kpiValue("Conversion Rate")).toHaveText("–");
    await expect(page.getByRole("button", { name: "Conversion Rate", exact: true })).toBeDisabled();
    await expect(page.getByText("Noch keine Conversion-Ziele")).toBeVisible();
    await expect(page.getByRole("note", { name: "Hinweis zu Demo-Daten" })).toHaveCount(0);
    const sources = page.getByRole("region", { name: "Traffic nach Quelle" });
    await expect(sources.getByRole("table")).toContainText("E-Mail");
    const pages = page.getByRole("region", { name: "Beliebteste Seiten" });
    await expect(pages.getByRole("table")).toContainText("/tracking-test");

    // Echtzeit (Phase 6)
    await page.getByRole("link", { name: "Echtzeit" }).first().click();
    await expect(page.getByRole("heading", { name: "Echtzeit", level: 1 })).toBeVisible();
    await expect(page.getByTestId("active-now")).toHaveText("1");
    await expect(page.getByRole("region", { name: "Letzte Events" })).toContainText("test_button_clicked");
    await expect(page.getByRole("region", { name: "Aktuelle Seiten (letzte 5 Min.)" })).toContainText("/tracking-test");

    // Besucher (Phase 6)
    await page.getByRole("link", { name: "Besucher" }).first().click();
    await expect(page.getByRole("heading", { name: "Besucher", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Seiten pro Session" }).getByRole("table")).toContainText("2 Seiten");
    await expect(page.getByText("Ø 2,0 Seiten pro Session")).toBeVisible();
    await page.goto(`/analytics/${siteId}/settings`);
    const status = page.getByTestId("tracking-status");
    await expect(status).toContainText("Tracking aktiv");
    await expect(status).toContainText("2 Seitenaufrufe");
    await expect(status).toContainText("1 Sessions");
    await expect(status).toContainText(/[3-9] Events/);
  });
});
