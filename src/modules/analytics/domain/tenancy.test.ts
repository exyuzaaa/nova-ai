import { describe, expect, it } from "vitest";
import { assignableRoles, hasRole, invitableRoles } from "./roles";
import { invitationSchema, normalizeDomain, slugify, websiteSchema } from "./tenancy-validation";

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

describe("slugify", () => {
  it("bildet deutsche Umlaute ab", () => {
    expect(slugify("Müller & Söhne GmbH")).toBe("mueller-soehne-gmbh");
    expect(slugify("Straße 1")).toBe("strasse-1");
  });

  it("erfüllt die Datenbankregel für Kürzel", () => {
    for (const name of ["A", "!!!", "Sehr langer Name ".repeat(10), "Ärger"]) {
      expect(slugify(name)).toMatch(/^[a-z0-9][a-z0-9-]{1,62}$/);
    }
  });
});

describe("Formulare für Websites und Einladungen", () => {
  it("normalisiert die Domain beim Anlegen", () => {
    const result = websiteSchema.safeParse({ name: " Shop ", domain: "https://www.shop.de/", timezone: "Europe/Berlin" });
    expect(result.success && result.data).toEqual({ name: "Shop", domain: "shop.de", timezone: "Europe/Berlin" });
  });

  it("lehnt unbekannte Zeitzonen ab", () => {
    expect(websiteSchema.safeParse({ name: "x", domain: "x.de", timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("erlaubt keine Owner-Einladung", () => {
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "admin" }).success).toBe(true);
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "superuser" }).success).toBe(false);
  });
});

describe("Rollen", () => {
  it("bildet die Hierarchie ab", () => {
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("analyst", "admin")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
  });

  it("lässt Owner-Rechte nur durch Owner vergeben", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).not.toContain("owner");
    expect(assignableRoles("analyst")).toEqual([]);
    expect(invitableRoles("owner")).not.toContain("owner");
  });
});
