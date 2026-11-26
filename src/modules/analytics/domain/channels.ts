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
