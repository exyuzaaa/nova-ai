import { z } from "zod";

/* Fachliche Regeln des Finanzmoduls (die Datenbank rechnet verbindlich; hier: Eingaben, Anzeige). */

export const DOCUMENT_KINDS = ["quote", "invoice", "credit_note"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const KIND_LABELS: Record<DocumentKind, string> = { quote: "Angebot", invoice: "Rechnung", credit_note: "Gutschrift" };
export const KIND_PLURAL: Record<DocumentKind, string> = { quote: "Angebote", invoice: "Rechnungen", credit_note: "Gutschriften" };

export const STATUS_LABELS = {
  draft: "Entwurf",
  sent: "Versendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  issued: "Offen",
  partially_paid: "Teilweise bezahlt",
  paid: "Bezahlt",
  cancelled: "Storniert",
} as const;
export type DocumentStatus = keyof typeof STATUS_LABELS;

export const PAYMENT_METHODS = { transfer: "Überweisung", cash: "Bar", card: "Karte", direct_debit: "Lastschrift", paypal: "PayPal", other: "Sonstige" } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const TAX_RATES = [19, 7, 0] as const;

/** Geld im deutschen Format, z. B. „1.234,50 €“. */
export const formatEuro = (value: number, currency = "EUR") =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);

export const formatQuantity = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);

/** Zahl in deutscher Schreibweise lesen („1.234,50“, „-2,5“, „12.5“). */
export const parseNumber = (value: string): number | null => {
  const trimmed = value.trim().replace(/\s|€/g, "");
  if (trimmed === "") return null;
  const negative = trimmed.startsWith("-");
  const body = negative ? trimmed.slice(1) : trimmed;
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(body)) normalized = body.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(body)) normalized = body.replace(",", ".");
  else if (/^\d+(\.\d+)?$/.test(body)) normalized = body;
  else return Number.NaN;
  return (negative ? -1 : 1) * Number(normalized);
};

const number = (label: string, min: number, max: number, decimals: number) =>
  z
    .string()
    .transform(parseNumber)
    .pipe(
      z
        .number({ error: `${label}: bitte als Zahl eingeben.` })
        .min(min, { error: `${label} ist zu klein.` })
        .max(max, { error: `${label} ist zu groß.` })
        .refine((value) => Math.abs(Math.round(value * 10 ** decimals) - value * 10 ** decimals) < 1e-6, {
          error: `${label}: höchstens ${decimals} Nachkommastellen.`,
        }),
    );

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} darf höchstens ${max} Zeichen lang sein.` })
    .transform((value) => (value === "" ? null : value));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().regex(ISO, { error: "Bitte gib ein gültiges Datum ein." }).nullable());
const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.uuid().nullable());

/** IBAN-Prüfung (Modulo 97). */
export const isValidIban = (value: string) => {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  let remainder = 0;
  for (const char of iban.slice(4) + iban.slice(0, 4)) {
    const code = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of code) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
};

export const settingsSchema = z.object({
  legal_name: optional(200, "Der Name"),
  street: optional(200, "Die Straße"),
  postal_code: optional(20, "Die PLZ"),
  city: optional(120, "Der Ort"),
  country_code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { error: "Bitte den Ländercode angeben, z. B. DE." }),
  email: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value.toLowerCase()))
    .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }).nullable()),
  phone: optional(50, "Die Telefonnummer"),
  website: optional(200, "Die Website"),
  vat_id: optional(30, "Die USt-IdNr."),
  tax_number: optional(30, "Die Steuernummer"),
  register_info: optional(200, "Der Registereintrag"),
  managing_directors: optional(200, "Die Geschäftsführung"),
  bank_name: optional(120, "Die Bank"),
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
  payment_terms_days: z.coerce.number({ error: "Bitte eine Zahl eingeben." }).int().min(0).max(365),
  quote_valid_days: z.coerce.number({ error: "Bitte eine Zahl eingeben." }).int().min(1).max(365),
  default_tax_rate: number("Der Steuersatz", 0, 100, 2),
  small_business: z.boolean(),
  invoice_footer: optional(1000, "Der Fußtext"),
});

export const articleSchema = z.object({
  name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(200),
  description: optional(2000, "Die Beschreibung"),
  unit: z.string().trim().min(1, { error: "Bitte gib eine Einheit an." }).max(20),
  unit_price: number("Der Preis", -100_000_000, 100_000_000, 2),
  tax_rate: number("Der Steuersatz", 0, 100, 2),
});

export const documentSchema = z
  .object({
    customer_id: optionalUuid,
    project_id: optionalUuid,
    title: optional(200, "Der Betreff"),
    intro_text: optional(2000, "Der Einleitungstext"),
    closing_text: optional(2000, "Der Schlusstext"),
    recipient_name: optional(200, "Der Empfänger"),
    recipient_extra: optional(200, "Der Zusatz"),
    recipient_street: optional(200, "Die Straße"),
    recipient_postal: optional(20, "Die PLZ"),
    recipient_city: optional(120, "Der Ort"),
    recipient_country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, { error: "Bitte den Ländercode angeben, z. B. DE." }),
    recipient_vat_id: optional(30, "Die USt-IdNr."),
    issue_date: optionalDate,
    service_date: optionalDate,
    service_end_date: optionalDate,
    due_date: optionalDate,
    valid_until: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (value.service_date && value.service_end_date && value.service_end_date < value.service_date) {
      ctx.addIssue({ code: "custom", path: ["service_end_date"], message: "Das Ende liegt vor dem Beginn." });
    }
  });

export const lineSchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib eine Bezeichnung ein." }).max(300),
  description: optional(2000, "Die Beschreibung"),
  quantity: number("Die Menge", -1_000_000, 1_000_000, 3),
  unit: z.string().trim().min(1, { error: "Bitte gib eine Einheit an." }).max(20),
  unit_price: number("Der Einzelpreis", -100_000_000, 100_000_000, 2),
  discount_percent: z
    .string()
    .transform((value) => (value.trim() === "" ? "0" : value))
    .pipe(number("Der Rabatt", 0, 100, 2)),
  tax_rate: number("Der Steuersatz", 0, 100, 2),
});

export const paymentSchema = z.object({
  amount: number("Der Betrag", -100_000_000, 100_000_000, 2).refine((value) => value !== 0, { error: "Der Betrag darf nicht 0 sein." }),
  paid_on: z.string().regex(ISO, { error: "Bitte gib ein gültiges Datum ein." }),
  method: z.enum(Object.keys(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]]),
  note: optional(500, "Die Notiz"),
});

// -----------------------------------------------------------------------------
// Rechnen (Vorschau; verbindlich rechnet die Datenbank genauso)
// -----------------------------------------------------------------------------
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const lineNet = (line: { quantity: number; unitPrice: number; discountPercent: number }) =>
  round2(line.quantity * line.unitPrice * (1 - line.discountPercent / 100));

export const totals = (lines: { quantity: number; unitPrice: number; discountPercent: number; taxRate: number }[], smallBusiness: boolean) => {
  const byRate = new Map<number, number>();
  for (const line of lines) byRate.set(line.taxRate, round2((byRate.get(line.taxRate) ?? 0) + lineNet(line)));
  const breakdown = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, net]) => ({ rate, net, tax: smallBusiness ? 0 : round2((net * rate) / 100) }));
  const net = round2(breakdown.reduce((sum, row) => sum + row.net, 0));
  const tax = round2(breakdown.reduce((sum, row) => sum + row.tax, 0));
  return { net, tax, gross: round2(net + tax), breakdown };
};

/** Zahlungsstatus für die Anzeige (überfällig ergibt sich aus dem Fälligkeitsdatum). */
export const isOverdue = (doc: { kind: string; status: string; dueDate: string | null }, today: string) =>
  doc.kind === "invoice" && (doc.status === "issued" || doc.status === "partially_paid") && doc.dueDate !== null && doc.dueDate < today;
