import { z } from "zod";
import { isLocalDateTime } from "@/modules/core/domain/time-zone";

/* Fachliche Regeln des CRM (Spiegel der Checks in der Datenbank). */

export const CUSTOMER_KINDS = ["company", "person"] as const;
export const CUSTOMER_KIND_LABELS: Record<(typeof CUSTOMER_KINDS)[number], string> = { company: "Firma", person: "Privatperson" };

export const CUSTOMER_STATUSES = ["prospect", "active", "inactive"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = { prospect: "Interessent", active: "Aktiv", inactive: "Inaktiv" };

export const LEAD_SOURCES = ["website", "referral", "event", "cold_call", "campaign", "social", "partner", "other"] as const;
export const LEAD_SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  website: "Website",
  referral: "Empfehlung",
  event: "Veranstaltung",
  cold_call: "Kaltakquise",
  campaign: "Kampagne",
  social: "Social Media",
  partner: "Partner",
  other: "Sonstige",
};

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  unqualified: "Nicht qualifiziert",
  converted: "Umgewandelt",
};

export const ACTIVITY_KINDS = ["note", "call", "meeting", "email", "task"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: "Notiz",
  call: "Anruf",
  meeting: "Termin",
  email: "E-Mail",
  task: "Aufgabe",
};

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} darf höchstens ${max} Zeichen lang sein.` })
    .transform((value) => (value === "" ? null : value));

const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toLowerCase()))
  .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }).nullable());

const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.uuid().nullable());

/** Datum/Uhrzeit aus <input type="datetime-local">; gilt in der Zeitzone des Unternehmens (Umrechnung im Server). */
const optionalDateTime = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().refine(isLocalDateTime, { error: "Bitte gib ein gültiges Datum ein." }).nullable());

/** Schlagwörter: kommagetrennt, getrimmt, ohne Dubletten, höchstens 20 à 40 Zeichen. */
export const parseTags = (value: string): string[] =>
  [...new Set(value.split(",").map((tag) => tag.trim().slice(0, 40)).filter(Boolean))].slice(0, 20);

export const customerSchema = z.object({
  kind: z.enum(CUSTOMER_KINDS, { error: "Bitte wähle Firma oder Privatperson." }),
  name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(200, { error: "Der Name ist zu lang." }),
  email: optionalEmail,
  phone: optional(50, "Die Telefonnummer"),
  website: optional(200, "Die Website"),
  vat_id: optional(30, "Die USt-IdNr."),
  street: optional(200, "Die Straße"),
  postal_code: optional(20, "Die Postleitzahl"),
  city: optional(120, "Der Ort"),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: "Bitte wähle ein Land." }),
  status: z.enum(CUSTOMER_STATUSES, { error: "Bitte wähle einen Status." }),
  category: optional(80, "Die Kategorie"),
  tags: z.string().transform(parseTags),
  description: optional(5000, "Die Beschreibung"),
  owner_member_id: optionalUuid,
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const contactSchema = z
  .object({
    first_name: optional(100, "Der Vorname"),
    last_name: optional(100, "Der Nachname"),
    position: optional(120, "Die Position"),
    email: optionalEmail,
    phone: optional(50, "Die Telefonnummer"),
    is_primary: z.boolean(),
  })
  .refine((value) => value.first_name || value.last_name, { error: "Bitte gib einen Vor- oder Nachnamen ein.", path: ["last_name"] });

export const activitySchema = z
  .object({
    kind: z.enum(ACTIVITY_KINDS, { error: "Bitte wähle eine Art." }),
    subject: z.string().trim().min(1, { error: "Bitte gib einen Betreff ein." }).max(200, { error: "Der Betreff ist zu lang." }),
    body: optional(10000, "Der Text"),
    due_at: optionalDateTime,
    assigned_member_id: optionalUuid,
  })
  .refine((value) => value.kind !== "task" || value.due_at, { error: "Aufgaben brauchen ein Fälligkeitsdatum.", path: ["due_at"] });

// -----------------------------------------------------------------------------
// Listen: Filter aus der Adresszeile (nur erlaubte Werte, alles andere wird ignoriert)
// -----------------------------------------------------------------------------
export const CUSTOMER_SORTS = ["name", "number", "created_at", "updated_at"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export const PAGE_SIZE = 25;

export type CustomerListQuery = {
  q: string;
  status: CustomerStatus | null;
  owner: string | null;
  archived: boolean;
  sort: CustomerSort;
  descending: boolean;
  page: number;
};

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export const parseCustomerListQuery = (params: Record<string, string | string[] | undefined>): CustomerListQuery => {
  const status = first(params.status);
  const owner = first(params.zustaendig);
  const sort = first(params.sortierung);
  const page = Number.parseInt(first(params.seite), 10);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: (CUSTOMER_STATUSES as readonly string[]).includes(status) ? (status as CustomerStatus) : null,
    owner: z.uuid().safeParse(owner).success ? owner : null,
    archived: first(params.archiv) === "1",
    sort: (CUSTOMER_SORTS as readonly string[]).includes(sort) ? (sort as CustomerSort) : "name",
    descending: first(params.richtung) === "ab",
    page: Number.isFinite(page) && page > 0 && page <= 10_000 ? page : 1,
  };
};

/** Suchbegriff für PostgREST-Filter entschärfen (keine Trenn- oder Platzhalterzeichen). */
export const sanitizeSearchTerm = (value: string): string => value.replace(/[,()*%_\\:"'.]/g, " ").replace(/\s+/g, " ").trim();

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
export const formatMoney = (amount: number, currency = "EUR"): string =>
  currency === "EUR" ? euro.format(amount) : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

// -----------------------------------------------------------------------------
// Beträge und Leads
// -----------------------------------------------------------------------------

/** Betrag in deutscher oder technischer Schreibweise ("1.234,56" / "1234.56") → Zahl; leer → null. */
export const parseAmount = (value: string): number | null | "invalid" => {
  const trimmed = value.trim().replace(/\s|€/g, "");
  if (trimmed === "") return null;
  // "1.500" ist im Deutschen eintausendfünfhundert (Tausenderpunkte ohne Komma)
  const germanThousands = /^\d{1,3}(\.\d{3})+$/.test(trimmed);
  const normalized = trimmed.includes(",") || germanThousands ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return "invalid";
  const amount = Number(normalized);
  return amount <= 999_999_999_999 ? amount : "invalid";
};

const optionalAmount = z.string().transform((value, context) => {
  const amount = parseAmount(value);
  if (amount === "invalid") {
    context.addIssue({ code: "custom", message: "Bitte gib einen gültigen Betrag ein, z. B. 1.500,00." });
    return z.NEVER;
  }
  return amount;
});

/** Status, die man im Formular wählen darf („Umgewandelt“ setzt nur die Umwandlung). */
export const EDITABLE_LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified"] as const;
export const OPEN_LEAD_STATUSES = ["new", "contacted", "qualified"] as const;

export const leadSchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein, z. B. die Anfrage." }).max(200, { error: "Der Titel ist zu lang." }),
  company_name: optional(200, "Die Firma"),
  contact_name: optional(200, "Der Name"),
  email: optionalEmail,
  phone: optional(50, "Die Telefonnummer"),
  source: z.enum(LEAD_SOURCES, { error: "Bitte wähle eine Quelle." }),
  status: z.enum(EDITABLE_LEAD_STATUSES, { error: "Bitte wähle einen Status." }),
  score: z.coerce
    .number({ error: "Bitte gib eine Zahl von 0 bis 100 ein." })
    .int({ error: "Bitte gib eine ganze Zahl ein." })
    .min(0, { error: "Mindestens 0." })
    .max(100, { error: "Höchstens 100." }),
  estimated_value: optionalAmount,
  owner_member_id: optionalUuid,
  follow_up_at: optionalDateTime,
  notes: optional(5000, "Die Notiz"),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const LEAD_SORTS = ["follow_up_at", "created_at", "score", "title"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export type LeadListQuery = {
  q: string;
  /** "open" = neu, kontaktiert, qualifiziert; "all" = alle; sonst ein einzelner Status */
  status: LeadStatus | "open" | "all";
  source: (typeof LEAD_SOURCES)[number] | null;
  owner: string | null;
  sort: LeadSort;
  page: number;
};

export const parseLeadListQuery = (params: Record<string, string | string[] | undefined>): LeadListQuery => {
  const status = first(params.status);
  const source = first(params.quelle);
  const owner = first(params.zustaendig);
  const sort = first(params.sortierung);
  const page = Number.parseInt(first(params.seite), 10);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: status === "all" || (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus | "all") : "open",
    source: (LEAD_SOURCES as readonly string[]).includes(source) ? (source as (typeof LEAD_SOURCES)[number]) : null,
    owner: z.uuid().safeParse(owner).success ? owner : null,
    sort: (LEAD_SORTS as readonly string[]).includes(sort) ? (sort as LeadSort) : "follow_up_at",
    page: Number.isFinite(page) && page > 0 && page <= 10_000 ? page : 1,
  };
};

// -----------------------------------------------------------------------------
// Verkaufschancen und Pipeline
// -----------------------------------------------------------------------------
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Bitte gib ein gültiges Datum ein." })
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), { error: "Bitte gib ein gültiges Datum ein." })
      .nullable(),
  );

const optionalPercent = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 100) {
      context.addIssue({ code: "custom", message: "Bitte gib eine ganze Zahl von 0 bis 100 ein." });
      return z.NEVER;
    }
    return number;
  });

export const opportunitySchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein." }).max(200, { error: "Der Titel ist zu lang." }),
  amount: z.string().transform((value, context) => {
    const amount = parseAmount(value);
    if (amount === "invalid" || amount === null) {
      context.addIssue({ code: "custom", message: "Bitte gib einen Betrag ein, z. B. 12.000,00." });
      return z.NEVER;
    }
    return amount;
  }),
  stage_id: z.uuid({ error: "Bitte wähle eine Phase." }),
  probability: optionalPercent,
  expected_close_date: optionalDate,
  owner_member_id: optionalUuid,
  lost_reason: optional(500, "Der Grund"),
  notes: optional(5000, "Die Notiz"),
});

export type StageKind = "open" | "won" | "lost";

/** Gewichteter Wert: Betrag × Wahrscheinlichkeit (eigene oder die der Phase); gewonnen 100 %, verloren 0 %. */
export const weightedAmount = (amount: number, stage: { kind: StageKind; probability: number }, override: number | null): number => {
  if (stage.kind === "won") return amount;
  if (stage.kind === "lost") return 0;
  const probability = override ?? stage.probability;
  return Math.round(amount * probability) / 100;
};

/** Summen je Phase für das Board. */
export const summarizeStage = (
  items: { amount: number; probability: number | null }[],
  stage: { kind: StageKind; probability: number },
): { count: number; total: number; weighted: number } => ({
  count: items.length,
  total: items.reduce((sum, item) => sum + item.amount, 0),
  weighted: Math.round(items.reduce((sum, item) => sum + weightedAmount(item.amount, stage, item.probability) * 100, 0)) / 100,
});
