import { describe, expect, it } from "vitest";
import { absenceRequestSchema, adjustmentSchema, employeeSchema, formatDays, isValidIban, parseDecimal, privateSchema } from "./hr";

const employee = {
  first_name: " Emil ",
  last_name: "Eifrig",
  work_email: "EMIL@firma.example",
  work_phone: "",
  position: "",
  department_id: "",
  manager_employee_id: "",
  member_id: "",
  employment_type: "part_time",
  entry_date: "2027-01-01",
  exit_date: "",
  weekly_hours: "20,5",
  work_days: ["1", "2", "3"],
  vacation_days: "18",
};

describe("Mitarbeiter", () => {
  it("normalisiert Eingaben", () => {
    expect(employeeSchema.parse(employee)).toMatchObject({
      first_name: "Emil",
      work_email: "emil@firma.example",
      position: null,
      weekly_hours: 20.5,
      work_days: [1, 2, 3],
      vacation_days: 18,
    });
  });

  it("prüft Austritt, Arbeitstage und Zahlen", () => {
    expect(employeeSchema.safeParse({ ...employee, exit_date: "2026-12-31" }).error?.issues[0].message).toBe("Der Austritt liegt vor dem Eintritt.");
    expect(employeeSchema.safeParse({ ...employee, work_days: [] }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...employee, vacation_days: "" }).success).toBe(false);
    expect(employeeSchema.safeParse({ ...employee, weekly_hours: "viel" }).success).toBe(false);
  });

  it("liest deutsche Zahlen", () => {
    expect(parseDecimal("3.800,00")).toBe(3800);
    expect(parseDecimal("38,5")).toBe(38.5);
    expect(parseDecimal("1.500")).toBe(1500);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNaN();
  });
});

describe("Vertrauliche Daten", () => {
  it("prüft die IBAN mit Prüfziffer", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    const base = Object.fromEntries(Object.keys(privateSchema.shape).map((key) => [key, ""]));
    expect(privateSchema.parse({ ...base, iban: "de89 3704 0044 0532 0130 00", salary_amount: "3.800,00", salary_period: "month" })).toMatchObject({
      iban: "DE89370400440532013000",
      salary_amount: 3800,
      birth_date: null,
    });
    expect(privateSchema.safeParse({ ...base, iban: "DE00123" }).success).toBe(false);
  });
});

describe("Abwesenheiten", () => {
  const request = {
    employee_id: "6f3c2a52-6d0d-4c0e-8f53-6d0c3d6a8d11",
    type_id: "6f3c2a52-6d0d-4c0e-8f53-6d0c3d6a8d12",
    start_date: "2027-03-05",
    end_date: "2027-03-01",
    half_day_start: false,
    half_day_end: false,
    note: "",
  };
  it("Ende nicht vor Beginn", () => {
    expect(absenceRequestSchema.safeParse(request).error?.issues[0].message).toBe("Das Ende liegt vor dem Beginn.");
    expect(absenceRequestSchema.safeParse({ ...request, end_date: "2027-03-05" }).success).toBe(true);
  });

  it("Korrekturen mit Vorzeichen", () => {
    expect(adjustmentSchema.parse({ year: "2027", days: "-1,5", reason: "Korrektur" }).days).toBe(-1.5);
    expect(adjustmentSchema.parse({ year: "2027", days: "2", reason: "Übertrag" }).days).toBe(2);
    expect(adjustmentSchema.safeParse({ year: "2027", days: "", reason: "x" }).success).toBe(false);
    expect(formatDays(1)).toBe("1 Tag");
    expect(formatDays(2.5)).toBe("2,5 Tage");
  });
});
