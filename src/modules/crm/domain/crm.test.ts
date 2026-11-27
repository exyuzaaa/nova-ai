import { describe, expect, it } from "vitest";
import {
  activitySchema,
  contactSchema,
  customerSchema,
  parseCustomerListQuery,
  parseTags,
  sanitizeSearchTerm,
} from "./crm";

const customer = (overrides: Record<string, string> = {}) => ({
  kind: "company",
  name: "Müller GmbH",
  email: "",
  phone: "",
  website: "",
  vat_id: "",
  street: "",
  postal_code: "",
  city: "",
  country_code: "de",
  status: "active",
  category: "",
  tags: "",
  description: "",
  owner_member_id: "",
  ...overrides,
});

describe("Kunden", () => {
  it("normalisiert Eingaben", () => {
    const result = customerSchema.parse(customer({ email: " Info@Mueller.DE ", tags: "B2B, Maschinenbau, b2b ,, Maschinenbau" }));
    expect(result.email).toBe("info@mueller.de");
    expect(result.tags).toEqual(["B2B", "Maschinenbau", "b2b"]);
    expect(result.country_code).toBe("DE");
    expect(result.phone).toBeNull();
  });

  it.each([
    [{ name: " " }, "name"],
    [{ kind: "firma" }, "kind"],
    [{ status: "vip" }, "status"],
    [{ email: "keine" }, "email"],
    [{ owner_member_id: "1; drop" }, "owner_member_id"],
  ])("lehnt %o ab", (overrides, field) => {
    const result = customerSchema.safeParse(customer(overrides));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path[0]).toBe(field);
  });

  it("begrenzt Schlagwörter", () => {
    expect(parseTags(Array.from({ length: 30 }, (_, index) => `t${index}`).join(","))).toHaveLength(20);
  });
});

describe("Ansprechpartner und Aktivitäten", () => {
  it("verlangt einen Namen", () => {
    expect(contactSchema.safeParse({ first_name: "", last_name: "", position: "", email: "", phone: "", is_primary: false }).success).toBe(false);
    expect(contactSchema.safeParse({ first_name: "", last_name: "Sonne", position: "", email: "", phone: "", is_primary: true }).success).toBe(true);
  });

  it("verlangt bei Aufgaben eine Fälligkeit", () => {
    const base = { kind: "task", subject: "Nachfassen", body: "", due_at: "", assigned_member_id: "" };
    expect(activitySchema.safeParse(base).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, due_at: "2026-12-01T10:00" }).success).toBe(true);
    expect(activitySchema.safeParse({ ...base, kind: "note" }).success).toBe(true);
  });
});

describe("Listenfilter aus der Adresse", () => {
  it("übernimmt nur erlaubte Werte", () => {
    expect(
      parseCustomerListQuery({ q: " Müller ", status: "vip", sortierung: "password", seite: "-3", zustaendig: "x", richtung: "ab" }),
    ).toEqual({ q: "Müller", status: null, owner: null, archived: false, sort: "name", descending: true, page: 1 });
    expect(parseCustomerListQuery({ status: "active", sortierung: "number", seite: "2", archiv: "1" })).toMatchObject({
      status: "active",
      sort: "number",
      page: 2,
      archived: true,
    });
  });

  it("entschärft Suchbegriffe für Datenbankfilter", () => {
    expect(sanitizeSearchTerm("a,b),name.eq.x*%")).toBe("a b name eq x");
  });
});

describe("Leads", () => {
  const lead = (overrides: Record<string, string> = {}) => ({
    title: "Anfrage Relaunch",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "website",
    status: "new",
    score: "40",
    estimated_value: "",
    owner_member_id: "",
    follow_up_at: "",
    notes: "",
    ...overrides,
  });

  it("liest Beträge in deutscher und technischer Schreibweise", async () => {
    const { parseAmount } = await import("./crm");
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1234.5")).toBe(1234.5);
    expect(parseAmount("8500 €")).toBe(8500);
    expect(parseAmount("1.500")).toBe(1500);
    expect(parseAmount("12.345.678")).toBe(12345678);
    expect(parseAmount("")).toBeNull();
    for (const value of ["-5", "1,234,5", "abc", "1.2.3", "10,999"]) expect(parseAmount(value)).toBe("invalid");
  });

  it("prüft Leads", async () => {
    const { leadSchema } = await import("./crm");
    expect(leadSchema.parse(lead({ estimated_value: "8.500,00" })).estimated_value).toBe(8500);
    expect(leadSchema.safeParse(lead({ status: "converted" })).success).toBe(false);
    expect(leadSchema.safeParse(lead({ score: "101" })).success).toBe(false);
    expect(leadSchema.safeParse(lead({ follow_up_at: "morgen" })).success).toBe(false);
    expect(leadSchema.safeParse(lead({ title: "" })).success).toBe(false);
  });

  it("filtert standardmäßig offene Leads", async () => {
    const { parseLeadListQuery } = await import("./crm");
    expect(parseLeadListQuery({})).toMatchObject({ status: "open", sort: "follow_up_at", page: 1 });
    expect(parseLeadListQuery({ status: "converted", quelle: "event" })).toMatchObject({ status: "converted", source: "event" });
    expect(parseLeadListQuery({ status: "geheim", quelle: "x" })).toMatchObject({ status: "open", source: null });
  });
});

describe("Verkaufschancen", () => {
  it("gewichtet mit eigener oder Phasen-Wahrscheinlichkeit", async () => {
    const { weightedAmount, summarizeStage } = await import("./crm");
    expect(weightedAmount(10_000, { kind: "open", probability: 25 }, null)).toBe(2500);
    expect(weightedAmount(10_000, { kind: "open", probability: 25 }, 60)).toBe(6000);
    expect(weightedAmount(10_000, { kind: "won", probability: 0 }, 10)).toBe(10_000);
    expect(weightedAmount(10_000, { kind: "lost", probability: 90 }, 90)).toBe(0);
    expect(weightedAmount(333.33, { kind: "open", probability: 33 }, null)).toBe(110);
    expect(summarizeStage([{ amount: 1000, probability: null }, { amount: 500, probability: 100 }], { kind: "open", probability: 50 })).toEqual({
      count: 2,
      total: 1500,
      weighted: 1000,
    });
  });

  it("prüft Verkaufschancen", async () => {
    const { opportunitySchema } = await import("./crm");
    const base = {
      title: "Wartungsvertrag",
      amount: "12.000",
      stage_id: "0a000000-0000-4000-8000-000000000001",
      probability: "",
      expected_close_date: "",
      owner_member_id: "",
      lost_reason: "",
      notes: "",
    };
    expect(opportunitySchema.parse(base)).toMatchObject({ amount: 12000, probability: null, expected_close_date: null });
    expect(opportunitySchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, probability: "150" }).success).toBe(false);
    expect(opportunitySchema.safeParse({ ...base, expected_close_date: "31.12.2026" }).success).toBe(false);
    expect(opportunitySchema.parse({ ...base, expected_close_date: "2026-12-31" }).expected_close_date).toBe("2026-12-31");
  });
});
