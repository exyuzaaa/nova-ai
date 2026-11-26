/**
 * Traffic-Kanäle (Architektur §2.5). Die regelbasierte Klassifikation folgt in Phase 5;
 * hier stehen die verbindlichen Schlüssel (identisch mit dem DB-Enum) und Beschriftungen.
 */
export const TRAFFIC_CHANNELS = [
  "organic_search",
  "paid_search",
  "direct",
  "referral",
  "social",
  "email",
  "display",
  "unassigned",
] as const;

export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number];

export const CHANNEL_LABELS: Record<TrafficChannel, string> = {
  organic_search: "Organic Search",
  paid_search: "Paid Search",
  direct: "Direct",
  referral: "Referral",
  social: "Social",
  email: "E-Mail",
  display: "Display",
  unassigned: "Nicht zugeordnet",
};

export const isTrafficChannel = (value: string): value is TrafficChannel =>
  (TRAFFIC_CHANNELS as readonly string[]).includes(value);

export const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobil",
  tablet: "Tablet",
  other: "Sonstige",
};

// -----------------------------------------------------------------------------
// Klassifikation (Architektur §2.5) – Reihenfolge der Regeln ist entscheidend.
// -----------------------------------------------------------------------------
const SEARCH_ENGINES = [
  "google.", "bing.com", "duckduckgo.com", "ecosia.org", "yahoo.", "startpage.com", "qwant.com",
  "search.brave.com", "yandex.", "baidu.com", "ask.com", "web.de", "t-online.de", "gmx.",
];
const SOCIAL_NETWORKS = [
  "facebook.com", "fb.com", "instagram.com", "linkedin.com", "lnkd.in", "t.co", "twitter.com", "x.com",
  "xing.com", "tiktok.com", "youtube.com", "youtu.be", "pinterest.", "reddit.com", "threads.net",
  "bsky.app", "mastodon.", "whatsapp.com", "snapchat.com",
];
const SOCIAL_SOURCES = ["facebook", "fb", "instagram", "ig", "linkedin", "twitter", "x", "xing", "tiktok", "youtube", "pinterest", "reddit"];
const EMAIL_HOSTS = ["mail.google.com", "outlook.live.com", "mail.yahoo.", "webmail.", "mail.", "email."];

const matchesHost = (host: string, patterns: string[]) =>
  patterns.some((pattern) =>
    pattern.endsWith(".") ? host.startsWith(pattern) || host.includes(`.${pattern}`) : host === pattern || host.endsWith(`.${pattern}`),
  );

export type ChannelInput = {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  clickIdType: string | null;
};

export const classifyChannel = ({ referrerHost, utmSource, utmMedium, clickIdType }: ChannelInput): TrafficChannel => {
  const medium = utmMedium?.toLowerCase() ?? "";
  const source = utmSource?.toLowerCase() ?? "";
  const host = referrerHost?.toLowerCase() ?? "";
  const fromSearch = matchesHost(host, SEARCH_ENGINES) || /google|bing|duckduckgo|ecosia|yahoo/.test(source);

  if (/^(cpc|ppc|paid|paidsearch|paid_search|sem)$/.test(medium) || ((clickIdType === "gclid" || clickIdType === "msclkid") && !/social/.test(medium))) {
    return fromSearch || clickIdType === "gclid" || clickIdType === "msclkid" ? "paid_search" : "unassigned";
  }
  if (/^(display|banner|cpm|programmatic|interstitial)$/.test(medium)) return "display";
  if (/e-?mail|newsletter/.test(medium) || /e-?mail|newsletter/.test(source) || matchesHost(host, EMAIL_HOSTS)) return "email";
  if (/social|paid_social|paidsocial/.test(medium) || clickIdType === "fbclid" || SOCIAL_SOURCES.includes(source) || matchesHost(host, SOCIAL_NETWORKS)) {
    return "social";
  }
  if (fromSearch && !medium) return "organic_search";
  if (medium === "organic") return "organic_search";
  if (medium === "referral" || (host && !source && !medium)) return "referral";
  if (!host && !source && !medium) return "direct";
  return "unassigned";
};
