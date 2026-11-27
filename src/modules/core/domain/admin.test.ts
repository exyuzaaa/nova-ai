import { describe, expect, it } from "vitest";
import { buildPlatformNavigation, isNavItemActive } from "../config/navigation";
import { departmentSchema, roleSchema, tenantProfileSchema } from "./admin-validation";

const profile = (overrides: Record<string, string> = {}) => ({
  name: "Muster GmbH",
  legal_name: "",
  street: "",
  postal_code: "",
  city: "",
  country_code: "de",
  phone: "",
  email: "",
  website: "",
  vat_id: "",
  industry: "",
  company_size: "",
  locale: "de",
  timezone: "Europe/Berlin",
  currency: "EUR",
  ...overrides,
});

describe("Unternehmensprofil", () => {
  it("leert optionale Felder statt leere Texte zu speichern", () => {
    const result = tenantProfileSchema.safeParse(profile());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.legal_name).toBeNull();
    expect(result.data.email).toBeNull();
    expect(result.data.company_size).toBeNull();
    expect(result.data.country_code).toBe("DE");
  });

  it("normalisiert Website, E-Mail und USt-IdNr.", () => {
    const result = tenantProfileSchema.safeParse(
      profile({ website: "beispiel.de/", email: " Info@Beispiel.DE ", vat_id: "de 123 456 789" }),
    );
    expect(result.success && result.data).toMatchObject({
      website: "https://beispiel.de",
      email: "info@beispiel.de",
      vat_id: "DE123456789",
    });
  });

  it.each([
    [{ vat_id: "DE12345" }, "vat_id"],
    [{ email: "keine-mail" }, "email"],
    [{ website: "nicht gültig" }, "website"],
    [{ company_size: "riesig" }, "company_size"],
    [{ timezone: "Mars/Olympus" }, "timezone"],
    [{ name: "" }, "name"],
  ])("lehnt %o ab", (overrides, field) => {
    const result = tenantProfileSchema.safeParse(profile(overrides));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe(field);
  });
});

describe("Rollen und Abteilungen", () => {
  it("verlangt einen Rollennamen", () => {
    expect(roleSchema.safeParse({ name: "  ", description: "" }).success).toBe(false);
    expect(roleSchema.safeParse({ name: "Vertrieb", description: "" }).success).toBe(true);
  });

  it("akzeptiert nur echte IDs für Bezüge", () => {
    expect(departmentSchema.safeParse({ name: "IT", description: "", parent_id: "", lead_member_id: "" }).success).toBe(true);
    expect(departmentSchema.safeParse({ name: "IT", description: "", parent_id: "x'; drop", lead_member_id: "" }).success).toBe(
      false,
    );
  });
});

describe("Plattform-Navigation", () => {
  const all = new Set(["core.members.read", "core.departments.read", "core.audit.read", "analytics.view"]);

  it("zeigt nur freigeschaltete Module mit Oberfläche", () => {
    const groups = buildPlatformNavigation("firma", all, new Set(["analytics", "crm"]));
    const modules = groups.find((group) => group.label === "Module");
    expect(modules?.items.map((item) => item.id)).toEqual(["analytics"]);
    expect(modules?.items[0].href).toBe("/app/firma/analytics");
  });

  it("blendet Module ohne Freischaltung oder Recht aus", () => {
    expect(buildPlatformNavigation("firma", all, new Set()).some((group) => group.label === "Module")).toBe(false);
    const noView = new Set(["core.members.read"]);
    expect(buildPlatformNavigation("firma", noView, new Set(["analytics"])).some((group) => group.label === "Module")).toBe(false);
  });

  it("zeigt Verwaltung nur mit Rechten", () => {
    const viewer = buildPlatformNavigation("firma", new Set(["core.members.read", "core.departments.read"]), new Set());
    const ids = viewer.find((group) => group.label === "Verwaltung")?.items.map((item) => item.id);
    expect(ids).toContain("members");
    expect(ids).not.toContain("audit");
    expect(buildPlatformNavigation("firma", new Set(), new Set()).map((group) => group.label)).toEqual(["Start"]);
  });

  it("markiert den aktiven Eintrag", () => {
    const [start] = buildPlatformNavigation("firma", all, new Set());
    expect(isNavItemActive(start.items[0], "/app/firma")).toBe(true);
    expect(isNavItemActive(start.items[0], "/app/firma/verwaltung")).toBe(false);
    const members = { id: "m", label: "M", href: "/app/firma/verwaltung/mitglieder", icon: "members" as const };
    expect(isNavItemActive(members, "/app/firma/verwaltung/mitglieder")).toBe(true);
  });

  it("kodiert das Kürzel in der Adresse", () => {
    expect(buildPlatformNavigation("a b", all, new Set())[0].items[0].href).toBe("/app/a%20b");
  });
});
