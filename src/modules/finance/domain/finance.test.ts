import { describe, expect, it } from "vitest";
import { formatEuro, isOverdue, lineNet, lineSchema, parseNumber, paymentSchema, settingsSchema, totals } from "./finance";

describe("Zahlen", () => {
  it("liest deutsche Schreibweise", () => {
    expect(parseNumber("1.234,50")).toBe(1234.5);
    expect(parseNumber("-2,5")).toBe(-2.5);
    expect(parseNumber("12.5")).toBe(12.5);
    expect(parseNumber("1.000")).toBe(1000);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("12,3,4")).toBeNaN();
    expect(formatEuro(1234.5).replace(/\s/g, " ")).toBe("1.234,50 €");
  });
});

describe("Positionen und Summen", () => {
  it("rechnet wie die Datenbank", () => {
    expect(lineNet({ quantity: 1, unitPrice: 50, discountPercent: 10 })).toBe(45);
    const result = totals(
      [
        { quantity: 2, unitPrice: 100, discountPercent: 0, taxRate: 19 },
        { quantity: 1, unitPrice: 50, discountPercent: 10, taxRate: 7 },
      ],
      false,
    );
    expect(result).toEqual({
      net: 245,
      tax: 41.15,
      gross: 286.15,
      breakdown: [
        { rate: 19, net: 200, tax: 38 },
        { rate: 7, net: 45, tax: 3.15 },
      ],
    });
    expect(totals([{ quantity: 1, unitPrice: 100, discountPercent: 0, taxRate: 19 }], true).gross).toBe(100);
  });

  it("prüft Positionen", () => {
    const base = { title: "Beratung", description: "", quantity: "1,5", unit: "Std.", unit_price: "120,00", discount_percent: "", tax_rate: "19" };
    expect(lineSchema.parse(base)).toMatchObject({ quantity: 1.5, unit_price: 120, discount_percent: 0, description: null });
    expect(lineSchema.safeParse({ ...base, unit_price: "1,234" }).success).toBe(false);
    expect(lineSchema.safeParse({ ...base, discount_percent: "120" }).success).toBe(false);
    expect(lineSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });
});

describe("Einstellungen und Zahlungen", () => {
  it("prüft IBAN und Zahlungen", () => {
    const settings = Object.fromEntries(Object.keys(settingsSchema.shape).map((key) => [key, ""]));
    const valid = { ...settings, country_code: "de", payment_terms_days: "14", quote_valid_days: "30", default_tax_rate: "19", small_business: false };
    expect(settingsSchema.parse({ ...valid, iban: "de89 3704 0044 0532 0130 00" }).iban).toBe("DE89370400440532013000");
    expect(settingsSchema.safeParse({ ...valid, iban: "DE89370400440532013001" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: "0", paid_on: "2026-11-28", method: "transfer", note: "" }).success).toBe(false);
    expect(paymentSchema.parse({ amount: "186,15", paid_on: "2026-11-28", method: "cash", note: "" }).amount).toBe(186.15);
  });

  it("überfällig", () => {
    expect(isOverdue({ kind: "invoice", status: "issued", dueDate: "2026-11-27" }, "2026-11-28")).toBe(true);
    expect(isOverdue({ kind: "invoice", status: "paid", dueDate: "2026-11-27" }, "2026-11-28")).toBe(false);
    expect(isOverdue({ kind: "quote", status: "sent", dueDate: "2026-11-27" }, "2026-11-28")).toBe(false);
  });
});
