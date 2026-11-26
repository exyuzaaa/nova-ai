/**
 * Bereinigung von Seiten- und Referrer-URLs vor dem Speichern.
 * Gespeichert werden nur Host, Pfad und UTM-Parameter – keine sonstigen
 * Query-Parameter, keine Fragmente, keine Click-ID-Werte.
 */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_IDS: Record<string, string> = { gclid: "gclid", gbraid: "gclid", wbraid: "gclid", msclkid: "msclkid", fbclid: "fbclid", ttclid: "ttclid", li_fat_id: "li_fat_id" };

export type PageInfo = {
  hostname: string;
  pathname: string;
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>>;
  clickIdType: string | null;
};

const EMAIL = /[^/\s@]+@[^/\s@]+\.[a-z]{2,}/gi;
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;

/** Mögliche personenbezogene Daten im Pfad durch Platzhalter ersetzen. */
export const scrubPath = (path: string): string => {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    /* ungültige Kodierung: Originalpfad weiterverwenden */
  }
  const cleaned = decoded.replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]");
  const normalized = cleaned.length > 1 ? cleaned.replace(/\/+$/, "") : cleaned;
  return (normalized || "/").slice(0, 2048);
};

const clean = (value: string | null): string | undefined => {
  const trimmed = value?.trim().toLowerCase().slice(0, 200);
  return trimmed ? trimmed : undefined;
};

export const parsePageUrl = (raw: string): PageInfo | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const utm: PageInfo["utm"] = {};
  for (const key of UTM_KEYS) {
    const value = clean(url.searchParams.get(key));
    if (value) utm[key] = value;
  }
  const clickKey = Object.keys(CLICK_IDS).find((key) => url.searchParams.has(key));
  return {
    hostname: url.hostname.toLowerCase().replace(/^www\./, ""),
    pathname: scrubPath(url.pathname),
    utm,
    clickIdType: clickKey ? CLICK_IDS[clickKey] : null,
  };
};

export type ReferrerInfo = { host: string; path: string } | null;

/** Externer Referrer (eigene Domain wird ignoriert); ohne Query und Fragment. */
export const parseReferrer = (raw: string | undefined, pageHost: string): ReferrerInfo => {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === pageHost || host.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${host}`)) return null;
    return { host, path: scrubPath(url.pathname).slice(0, 512) };
  } catch {
    return null;
  }
};
