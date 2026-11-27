import { z } from "zod";
import { requiredName } from "@/modules/core/domain/tenant-validation";

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

export const websiteSchema = z.object({
  name: requiredName("Namen"),
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
