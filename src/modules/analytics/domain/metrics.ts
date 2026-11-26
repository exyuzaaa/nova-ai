/**
 * Verbindliche Kennzahlen-Definitionen (Architektur §2.6).
 * Dashboard, Berichte, Exporte und KI verwenden ausschließlich diese Funktionen.
 */

/** Rohe, additive Bausteine eines Zeitraums oder Buckets. */
export type Totals = {
  /** Eindeutige Besucher – NICHT additiv über Zeiträume; kommt fertig aus der Datenquelle. */
  visitors: number;
  /** Nur mit Einwilligung bestimmbar, sonst null. */
  newVisitors: number | null;
  returningVisitors: number | null;
  sessions: number;
  pageviews: number;
  /** Sessions mit 1 Seitenaufruf, < 10 s Engagement und ohne Conversion. */
  bounces: number;
  /** Summe aktiver Engagement-Zeit in Millisekunden. */
  engagementMs: number;
  /** Sessions mit mindestens einer Conversion. */
  convertedSessions: number;
  conversions: number;
  /** Im CRM bestätigte Leads. */
  leads: number;
};

export const METRIC_KEYS = [
  "visitors",
  "sessions",
  "pageviews",
  "newVisitors",
  "returningVisitors",
  "avgSessionDuration",
  "bounceRate",
  "conversionRate",
  "leads",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricFormat = "count" | "duration" | "percent";

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  description: string;
  format: MetricFormat;
  higherIsBetter: boolean;
};

export const METRICS: Record<MetricKey, MetricDefinition> = {
  visitors: {
    key: "visitors",
    label: "Eindeutige Besucher",
    description: "Unterschiedliche Besucher im Zeitraum. Ohne Einwilligung wird pro Tag gezählt.",
    format: "count",
    higherIsBetter: true,
  },
  sessions: {
    key: "sessions",
    label: "Sessions",
    description: "Besuche; eine Session endet nach 30 Minuten Inaktivität oder bei Kampagnenwechsel.",
    format: "count",
    higherIsBetter: true,
  },
  pageviews: {
    key: "pageviews",
    label: "Seitenaufrufe",
    description: "Anzahl aufgerufener Seiten, inklusive Seitenwechsel in Single-Page-Apps.",
    format: "count",
    higherIsBetter: true,
  },
  newVisitors: {
    key: "newVisitors",
    label: "Neue Besucher",
    description: "Besucher mit ihrer ersten Session überhaupt. Nur mit Einwilligung bestimmbar.",
    format: "count",
    higherIsBetter: true,
  },
  returningVisitors: {
    key: "returningVisitors",
    label: "Wiederkehrende Besucher",
    description: "Besucher, die schon früher da waren. Nur mit Einwilligung bestimmbar.",
    format: "count",
    higherIsBetter: true,
  },
  avgSessionDuration: {
    key: "avgSessionDuration",
    label: "Ø\u00a0Sitzungsdauer",
    description: "Aktive Zeit (sichtbarer Tab mit Interaktion) je Session.",
    format: "duration",
    higherIsBetter: true,
  },
  bounceRate: {
    key: "bounceRate",
    label: "Absprungrate",
    description: "Sessions mit einem Seitenaufruf, unter 10 Sekunden Engagement und ohne Conversion.",
    format: "percent",
    higherIsBetter: false,
  },
  conversionRate: {
    key: "conversionRate",
    label: "Conversion Rate",
    description: "Anteil der Sessions mit mindestens einer erreichten Conversion.",
    format: "percent",
    higherIsBetter: true,
  },
  leads: {
    key: "leads",
    label: "Generierte Leads",
    description: "Im CRM bestätigte Leads, die einer Website-Session zugeordnet wurden.",
    format: "count",
    higherIsBetter: true,
  },
};

export type MetricValues = Record<MetricKey, number | null>;

const ratio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

/** Berechnet alle Kennzahlen aus additiven Bausteinen. Verhältnisse werden nie gemittelt. */
export const deriveMetrics = (totals: Totals): MetricValues => {
  const avgDurationMs = ratio(totals.engagementMs, totals.sessions);
  return {
    visitors: totals.visitors,
    sessions: totals.sessions,
    pageviews: totals.pageviews,
    newVisitors: totals.newVisitors,
    returningVisitors: totals.returningVisitors,
    avgSessionDuration: avgDurationMs === null ? null : avgDurationMs / 1000,
    bounceRate: ratio(totals.bounces, totals.sessions),
    conversionRate: ratio(totals.convertedSessions, totals.sessions),
    leads: totals.leads,
  };
};

export const emptyTotals = (): Totals => ({
  visitors: 0,
  newVisitors: 0,
  returningVisitors: 0,
  sessions: 0,
  pageviews: 0,
  bounces: 0,
  engagementMs: 0,
  convertedSessions: 0,
  conversions: 0,
  leads: 0,
});

export type DeltaDirection = "up" | "down" | "flat";

export type Delta = {
  absolute: number;
  /** Relative Veränderung (0.12 = +12 %); null, wenn der Vorwert 0 ist. */
  relative: number | null;
  direction: DeltaDirection;
};

/**
 * Unterhalb dieser Schwelle gilt eine Veränderung als „unverändert“ – passend zur
 * Anzeige mit einer Nachkommastelle (0,05 % bzw. 0,05 Prozentpunkte), damit nie
 * ein Pfeil neben „0,0“ steht.
 */
const FLAT_THRESHOLD = 0.0005;

export const computeDelta = (
  current: number | null,
  previous: number | null,
  format: MetricFormat = "count",
): Delta | null => {
  if (current === null || previous === null) return null;
  const absolute = current - previous;
  const relative = previous === 0 ? null : absolute / Math.abs(previous);
  // Prozent-Kennzahlen werden in Prozentpunkten angezeigt, also auch so bewertet.
  const magnitude = format === "percent" ? absolute : (relative ?? (absolute === 0 ? 0 : 1));
  const direction: DeltaDirection =
    Math.abs(magnitude) < FLAT_THRESHOLD ? "flat" : absolute > 0 ? "up" : "down";
  return { absolute, relative, direction };
};

export type DeltaTone = "positive" | "negative" | "neutral";

/** Ob eine Veränderung gut oder schlecht ist, hängt von der Kennzahl ab (Absprungrate ↑ = schlecht). */
export const deltaTone = (metric: MetricKey, delta: Delta | null): DeltaTone => {
  if (!delta || delta.direction === "flat") return "neutral";
  const isUp = delta.direction === "up";
  return isUp === METRICS[metric].higherIsBetter ? "positive" : "negative";
};
