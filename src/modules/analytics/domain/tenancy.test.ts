import { describe, expect, it } from "vitest";
import { normalizeDomain, websiteSchema } from "./tenancy-validation";

describe("normalizeDomain", () => {
  it.each([
    ["beispiel.de", "beispiel.de"],
    ["https://www.Beispiel.de/kontakt?x=1", "beispiel.de"],
    ["shop.beispiel.co.uk", "shop.beispiel.co.uk"],
    ["http://beispiel.de:8080", "beispiel.de"],
    ["BEISPIEL.DE.", "beispiel.de"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "localhost", "keine domain", "192.168.0.1", "-x.de", "x..de"])("lehnt %s ab", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe("Formular für Websites", () => {
  it("normalisiert die Domain beim Anlegen", () => {
    const result = websiteSchema.safeParse({ name: " Shop ", domain: "https://www.shop.de/", timezone: "Europe/Berlin" });
    expect(result.success && result.data).toEqual({ name: "Shop", domain: "shop.de", timezone: "Europe/Berlin" });
  });

  it("lehnt unbekannte Zeitzonen ab", () => {
    expect(websiteSchema.safeParse({ name: "x", domain: "x.de", timezone: "Mars/Olympus" }).success).toBe(false);
  });
});
