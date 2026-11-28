import { z } from "zod";

/* Fachliche Regeln des Personalmoduls (gespiegelt in den Prüfungen der Datenbank). */

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "mini_job", "apprentice", "intern", "working_student", "freelancer"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  mini_job: "Minijob",
  apprentice: "Ausbildung",
  intern: "Praktikum",
  working_student: "Werkstudium",
  freelancer: "Freie Mitarbeit",
};

export const ABSENCE_STATUS_LABELS = { requested: "Beantragt", approved: "Genehmigt", rejected: "Abgelehnt", cancelled: "Zurückgezogen" } as const;
export type AbsenceStatus = keyof typeof ABSENCE_STATUS_LABELS;

export const SALARY_PERIOD_LABELS = { month: "pro Monat", year: "pro Jahr", hour: "pro Stunde" } as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} darf höchstens ${max} Zeichen lang sein.` })
    .transform((value) => (value === "" ? null : value));
const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.uuid().nullable());
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().refine(isIsoDate, { error: "Bitte gib ein gültiges Datum ein." }).nullable());
const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }).nullable());

/** Zahl in deutscher Schreibweise („38,5“, „3.800,00“) → Zahl, leer → null. */
export const parseDecimal = (value: string): number | null => {
  const trimmed = value.trim().replace(/\s/g, "").replace(/€/g, "");
  if (trimmed === "") return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(trimmed) ? trimmed.replace(/\./g, "") : trimmed;
  return Number(normalized);
};

const decimal = (label: string, min: number, max: number) =>
  z
    .string()
    .transform(parseDecimal)
    .pipe(
      z
        .number({ error: `${label}: bitte als Zahl eingeben.` })
        .min(min, { error: `${label} muss mindestens ${min} sein.` })
        .max(max, { error: `${label} ist zu groß.` })
        .nullable(),
    );

export const employeeSchema = z
  .object({
    first_name: z.string().trim().min(1, { error: "Bitte gib den Vornamen ein." }).max(100),
    last_name: z.string().trim().min(1, { error: "Bitte gib den Nachnamen ein." }).max(100),
    work_email: optionalEmail,
    work_phone: optional(50, "Die Telefonnummer"),
    position: optional(120, "Die Position"),
    department_id: optionalUuid,
    manager_employee_id: optionalUuid,
    member_id: optionalUuid,
    employment_type: z.enum(EMPLOYMENT_TYPES, { error: "Bitte wähle eine Beschäftigungsart." }),
    entry_date: optionalDate,
    exit_date: optionalDate,
    weekly_hours: decimal("Die Wochenstunden", 0, 80),
    work_days: z.array(z.coerce.number().int().min(1).max(7)).min(1, { error: "Bitte wähle mindestens einen Arbeitstag." }),
    vacation_days: decimal("Der Urlaubsanspruch", 0, 100).pipe(z.number({ error: "Bitte gib den Urlaubsanspruch ein." })),
  })
  .superRefine((value, ctx) => {
    if (value.entry_date && value.exit_date && value.exit_date < value.entry_date) {
      ctx.addIssue({ code: "custom", path: ["exit_date"], message: "Der Austritt liegt vor dem Eintritt." });
    }
  });
export type EmployeeInput = z.infer<typeof employeeSchema>;

/** IBAN-Prüfung nach ISO 13616 (Modulo 97). */
export const isValidIban = (value: string): boolean => {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

export const privateSchema = z.object({
  birth_date: optionalDate,
  private_email: optionalEmail,
  private_phone: optional(50, "Die Telefonnummer"),
  street: optional(200, "Die Straße"),
  postal_code: optional(20, "Die Postleitzahl"),
  city: optional(120, "Der Ort"),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().regex(/^[A-Z]{2}$/, { error: "Bitte gib den Ländercode ein, z. B. DE." }).nullable()),
  iban: z
    .string()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().refine(isValidIban, { error: "Diese IBAN ist ungültig." }).nullable()),
  bic: z
    .string()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, { error: "Diese BIC ist ungültig." }).nullable()),
  tax_id: optional(20, "Die Steuer-ID"),
  social_security_no: optional(20, "Die Sozialversicherungsnummer"),
  health_insurance: optional(120, "Die Krankenkasse"),
  salary_amount: decimal("Die Vergütung", 0, 10_000_000),
  salary_period: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.enum(["month", "year", "hour"]).nullable()),
  emergency_contact: optional(300, "Der Notfallkontakt"),
  notes: optional(5000, "Die Notiz"),
});

export const absenceRequestSchema = z
  .object({
    employee_id: z.uuid({ error: "Bitte wähle eine Person." }),
    type_id: z.uuid({ error: "Bitte wähle eine Art." }),
    start_date: z.string().refine(isIsoDate, { error: "Bitte gib ein gültiges Datum ein." }),
    end_date: z.string().refine(isIsoDate, { error: "Bitte gib ein gültiges Datum ein." }),
    half_day_start: z.boolean(),
    half_day_end: z.boolean(),
    note: optional(1000, "Die Notiz"),
  })
  .superRefine((value, ctx) => {
    if (value.end_date < value.start_date) ctx.addIssue({ code: "custom", path: ["end_date"], message: "Das Ende liegt vor dem Beginn." });
    else if ((Date.parse(value.end_date) - Date.parse(value.start_date)) / 86400000 > 366)
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Höchstens ein Jahr am Stück." });
  });

export const absenceTypeSchema = z.object({
  name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/, { error: "Bitte wähle eine Farbe." }),
  deducts_vacation: z.boolean(),
  requires_approval: z.boolean(),
  is_sick: z.boolean(),
});

export const adjustmentSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  days: z
    .string()
    .transform((value) => parseDecimal(value.replace(/^-/, "")) === null ? null : (value.trim().startsWith("-") ? -1 : 1) * (parseDecimal(value.replace(/^-/, "")) ?? 0))
    .pipe(z.number({ error: "Bitte gib Tage als Zahl ein, z. B. 2,5 oder -1." }).min(-100).max(100)),
  reason: z.string().trim().min(1, { error: "Bitte gib einen Grund an." }).max(200),
});

export const formatDays = (days: number) => `${String(days).replace(".", ",")} ${days === 1 ? "Tag" : "Tage"}`;

export const fullName = (employee: { firstName: string; lastName: string }) => `${employee.firstName} ${employee.lastName}`;
