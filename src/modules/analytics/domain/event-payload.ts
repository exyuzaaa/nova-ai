import { z } from "zod";

/** Eingehendes Event des Tracking-Skripts (kompakte Feldnamen, max. 16 KB). */
export const EVENT_TYPES = [
  "pageview", "engagement", "custom", "outbound_click", "download",
  "form_start", "form_submit", "scroll", "phone_click", "email_click",
] as const;

/** Vom Skript gesendete Typen: alle Event-Typen plus Heartbeat (wird nicht als Event gespeichert). */
export const TRACKER_TYPES = [...EVENT_TYPES, "heartbeat"] as const;

export const MAX_PAYLOAD_BYTES = 16_384;

export const trackerPayloadSchema = z.object({
  s: z.string().regex(/^ns_[a-f0-9]{16}$/),
  t: z.enum(TRACKER_TYPES),
  n: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N}_.:\- ]+$/u).optional(),
  u: z.string().max(4096),
  r: z.string().max(2048).optional(),
  w: z.number().int().min(0).max(20000).optional(),
  e: z.number().int().min(0).max(1_800_000).optional(),
  d: z.number().int().min(0).max(100).optional(),
  c: z.boolean().optional(),
  p: z.record(z.string(), z.unknown()).optional(),
});

export type TrackerPayload = z.infer<typeof trackerPayloadSchema>;

const PII_PATTERNS = [
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, // E-Mail
  /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/, // IBAN
  /(?:\+|00)\d[\d\s/-]{7,}\d/, // Telefonnummer international
  /\b0\d{2,5}[\s/-]?\d{4,}\b/, // Telefonnummer national
];

export const containsPii = (value: string): boolean => PII_PATTERNS.some((pattern) => pattern.test(value));

/**
 * Eigenschaften von Custom Events: max. 30 Schlüssel, nur Text/Zahl/Wahrheitswert,
 * Texte ≤ 500 Zeichen. Werte, die nach personenbezogenen Daten aussehen, werden verworfen.
 */
export const sanitizeProps = (props: Record<string, unknown> | undefined): { props: Record<string, string | number | boolean>; dropped: number } => {
  const result: Record<string, string | number | boolean> = {};
  let dropped = 0;
  for (const [rawKey, value] of Object.entries(props ?? {}).slice(0, 30)) {
    const key = rawKey.trim().slice(0, 40);
    if (!/^[\p{L}\p{N}_.\-]+$/u.test(key)) {
      dropped += 1;
      continue;
    }
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      result[key] = value;
    } else if (typeof value === "string" && !containsPii(value)) {
      result[key] = value.slice(0, 500);
    } else {
      dropped += 1;
    }
  }
  return { props: result, dropped };
};
