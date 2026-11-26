import { z } from "zod";
import { MEMBER_ROLES } from "./roles";

/**
 * Domain aus einer Eingabe wie "https://www.Beispiel.de/kontakt" normalisieren:
 * Kleinbuchstaben, ohne Protokoll, Pfad, Port und führendes "www.".
 * Liefert null, wenn keine gültige Domain erkennbar ist.
 */
export const normalizeDomain = (input: string): string | null => {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");
  const label = "[a-z0-9]([a-z0-9-]*[a-z0-9])?";
  const valid = new RegExp(`^${label}(\\.${label})+$`).test(host) && host.length <= 253;
  if (!valid || /^\d+(\.\d+){3}$/.test(host)) return null;
  return host;
};

/** URL-taugliches Kürzel aus einem Namen ("Müller & Söhne GmbH" → "mueller-soehne-gmbh"). */
export const slugify = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : `org-${slug || "neu"}`;
};

const supportedTimeZones = new Set(
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Berlin", "UTC"],
);
supportedTimeZones.add("UTC");

export const COMMON_TIME_ZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/London",
  "Europe/Paris",
  "Europe/Amsterdam",
  "America/New_York",
  "UTC",
] as const;

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Bitte gib einen ${label} ein.` })
    .max(120, { error: `Der ${label} darf höchstens 120 Zeichen lang sein.` });

export const organizationSchema = z.object({ name: name("Namen") });

export const websiteSchema = z.object({
  name: name("Namen"),
  domain: z
    .string()
    .transform((value, context) => {
      const domain = normalizeDomain(value);
      if (!domain) {
        context.addIssue({ code: "custom", message: "Bitte gib eine gültige Domain ein, z. B. beispiel.de." });
        return z.NEVER;
      }
      return domain;
    }),
  timezone: z.string().refine((value) => supportedTimeZones.has(value), { error: "Unbekannte Zeitzone." }),
});

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." })),
  role: z.enum(MEMBER_ROLES).refine((role) => role !== "owner", { error: "Owner können nicht eingeladen werden." }),
});

export const uuidSchema = z.uuid();
