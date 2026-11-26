import { describe, expect, it } from "vitest";
import { buildIngestEvent, type RequestContext } from "../server/ingestion/build-event";
import { createRateLimiter } from "../server/ingestion/rate-limit";
import { classifyChannel } from "./channels";
import { containsPii, sanitizeProps } from "./event-payload";
import { parsePageUrl, parseReferrer, scrubPath } from "./url-sanitize";
import { isBot, parseUserAgent } from "./user-agent";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const channel = (referrerHost: string | null, utmSource: string | null = null, utmMedium: string | null = null, clickIdType: string | null = null) =>
  classifyChannel({ referrerHost, utmSource, utmMedium, clickIdType });

describe("Kanal-Klassifikation", () => {
  it.each([
    [channel(null), "direct"],
    [channel("google.de"), "organic_search"],
    [channel("www.bing.com"), "organic_search"],
    [channel("google.de", null, null, "gclid"), "paid_search"],
    [channel(null, "google", "cpc"), "paid_search"],
    [channel(null, "newsletter", "email"), "email"],
    [channel("linkedin.com"), "social"],
    [channel("l.facebook.com"), "social"],
    [channel(null, "instagram", "paid_social"), "social"],
    [channel(null, "partner", "display"), "display"],
    [channel("branchenbuch.example"), "referral"],
    [channel(null, "irgendwas", "unbekannt"), "unassigned"],
  ])("%s → %s", (actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe("User-Agent", () => {
  it("erkennt Browser, System und Gerät", () => {
    expect(parseUserAgent(CHROME_WIN)).toEqual({ deviceType: "desktop", browser: "Chrome", os: "Windows" });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ deviceType: "mobile", browser: "Safari", os: "iOS" });
  });

  it("filtert Bots und Automatisierung", () => {
    expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBot(CHROME_WIN.replace("Chrome/", "HeadlessChrome/"))).toBe(true);
    expect(isBot("curl/8.0")).toBe(true);
    expect(isBot("")).toBe(true);
    expect(isBot(CHROME_WIN)).toBe(false);
  });
});

describe("URL-Bereinigung", () => {
  it("behält nur Host, Pfad und UTM-Parameter", () => {
    const page = parsePageUrl("https://www.Beispiel.de/kontakt/?utm_source=Newsletter&utm_medium=email&token=geheim&gclid=abc#top");
    expect(page).toEqual({
      hostname: "beispiel.de",
      pathname: "/kontakt",
      utm: { utm_source: "newsletter", utm_medium: "email" },
      clickIdType: "gclid",
    });
  });

  it("entfernt E-Mail-Adressen und lange Tokens aus Pfaden", () => {
    expect(scrubPath("/abmelden/max%40beispiel.de")).toBe("/abmelden/[email]");
    expect(scrubPath("/reset/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8")).toBe("/reset/[token]");
  });

  it("lehnt ungültige URLs ab", () => {
    expect(parsePageUrl("javascript:alert(1)")).toBeNull();
    expect(parsePageUrl("keine url")).toBeNull();
  });

  it("ignoriert interne Referrer", () => {
    expect(parseReferrer("https://beispiel.de/preise?x=1", "beispiel.de")).toBeNull();
    expect(parseReferrer("https://www.google.de/search?q=geheim", "beispiel.de")).toEqual({ host: "google.de", path: "/search" });
  });
});

describe("Eigenschaften von Custom Events", () => {
  it("verwirft personenbezogene Werte und ungültige Typen", () => {
    const { props, dropped } = sanitizeProps({
      form_name: "kontakt",
      email: "max@beispiel.de",
      phone: "+49 170 1234567",
      count: 3,
      ok: true,
      nested: { a: 1 },
    });
    expect(props).toEqual({ form_name: "kontakt", count: 3, ok: true });
    expect(dropped).toBe(3);
  });

  it("erkennt typische personenbezogene Muster", () => {
    expect(containsPii("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(containsPii("0621 1234567")).toBe(true);
    expect(containsPii("Paket Premium")).toBe(false);
  });
});

describe("buildIngestEvent", () => {
  const context: RequestContext = { ip: "203.0.113.7", userAgent: CHROME_WIN, gpc: false, country: "DE", region: "BW", city: "Mannheim" };

  it("baut ein vollständiges Event", () => {
    const result = buildIngestEvent(
      { s: "ns_0123456789abcdef", t: "pageview", u: "https://beispiel.de/?utm_source=linkedin", r: "https://www.linkedin.com/feed/", w: 1440 },
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event).toMatchObject({
      type: "pageview",
      name: "pageview",
      hostname: "beispiel.de",
      pathname: "/",
      channel: "social",
      referrer_host: "linkedin.com",
      device_type: "desktop",
      country_code: "DE",
      utm_source: "linkedin",
    });
  });

  it("lehnt ungültige Daten, Bots und fehlende Namen ab", () => {
    expect(buildIngestEvent({ s: "x", t: "pageview", u: "https://a.de" }, context)).toEqual({ ok: false, reason: "invalid" });
    expect(buildIngestEvent({ s: "ns_0123456789abcdef", t: "custom", u: "https://a.de" }, context)).toEqual({ ok: false, reason: "invalid" });
    expect(buildIngestEvent({ s: "ns_0123456789abcdef", t: "pageview", u: "https://a.de" }, { ...context, userAgent: "Googlebot/2.1" })).toEqual({
      ok: false,
      reason: "bot",
    });
  });
});

describe("Rate-Limit", () => {
  it("begrenzt je Schlüssel und Zeitfenster", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 2)]).toEqual([true, true, false, true]);
    expect(allow("a", 1001)).toBe(true);
  });
});
