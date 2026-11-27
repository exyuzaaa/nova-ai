import { z } from "zod";
import { requiredName } from "./tenant-validation";

/** Unternehmensgrößen – identisch mit dem Check in core.tenants. */
export const COMPANY_SIZES = ["1", "2-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  "1": "Nur ich",
  "2-10": "2–10 Personen",
  "11-50": "11–50 Personen",
  "51-200": "51–200 Personen",
  "201-1000": "201–1.000 Personen",
  "1000+": "Über 1.000 Personen",
};

export const LOCALES = ["de", "en"] as const;
export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = { de: "Deutsch", en: "English" };

export const CURRENCIES = ["EUR", "CHF", "GBP", "USD"] as const;

/** Leere Eingaben werden zu null (Spalte leeren), Text wird getrimmt. */
const optionalText = (max: number, label: string) =>
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

const optionalWebsite = z
  .string()
  .trim()
  .max(200, { error: "Die Adresse ist zu lang." })
  .transform((value, context) => {
    if (value === "") return null;
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withProtocol);
      if (!url.hostname.includes(".")) throw new Error("kein Host");
      return url.toString().replace(/\/$/, "");
    } catch {
      context.addIssue({ code: "custom", message: "Bitte gib eine gültige Website-Adresse ein, z. B. beispiel.de." });
      return z.NEVER;
    }
  });

/** Deutsche USt-IdNr. streng, andere EU-Formate grob (Länderkennung + 2–13 Zeichen). */
const optionalVatId = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .refine((value) => value === "" || (value.startsWith("DE") ? /^DE\d{9}$/.test(value) : /^[A-Z]{2}[A-Z0-9+*]{2,13}$/.test(value)), {
    error: "Bitte gib eine gültige USt-IdNr. ein, z. B. DE123456789.",
  })
  .transform((value) => (value === "" ? null : value));

const supportedTimeZones = new Set(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Berlin", "UTC"],
);
supportedTimeZones.add("UTC");

export const tenantProfileSchema = z.object({
  name: requiredName("Namen"),
  legal_name: optionalText(200, "Die Firmierung"),
  street: optionalText(200, "Die Straße"),
  postal_code: optionalText(20, "Die Postleitzahl"),
  city: optionalText(120, "Der Ort"),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: "Bitte wähle ein Land." }),
  phone: optionalText(50, "Die Telefonnummer"),
  email: optionalEmail,
  website: optionalWebsite,
  vat_id: optionalVatId,
  industry: optionalText(80, "Die Branche"),
  company_size: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.enum(COMPANY_SIZES, { error: "Bitte wähle eine Unternehmensgröße." }).nullable()),
  locale: z.enum(LOCALES, { error: "Bitte wähle eine Sprache." }),
  timezone: z.string().refine((value) => supportedTimeZones.has(value), { error: "Unbekannte Zeitzone." }),
  currency: z.enum(CURRENCIES, { error: "Bitte wähle eine Währung." }),
});
export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;

export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Bitte gib einen Namen ein." })
    .max(80, { error: "Der Name darf höchstens 80 Zeichen lang sein." }),
  description: optionalText(300, "Die Beschreibung"),
});

export const departmentSchema = z.object({
  name: requiredName("Namen"),
  description: optionalText(500, "Die Beschreibung"),
  parent_id: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  lead_member_id: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
});

export const teamSchema = z.object({
  name: requiredName("Namen"),
  description: optionalText(500, "Die Beschreibung"),
  department_id: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  lead_member_id: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
});

/** Länder für das Profil (Auswahl; weitere per ISO-Code möglich). */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "CH", name: "Schweiz" },
  { code: "LU", name: "Luxemburg" },
  { code: "LI", name: "Liechtenstein" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "PL", name: "Polen" },
  { code: "DK", name: "Dänemark" },
  { code: "GB", name: "Vereinigtes Königreich" },
  { code: "US", name: "Vereinigte Staaten" },
];
