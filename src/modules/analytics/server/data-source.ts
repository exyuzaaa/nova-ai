import type { DateRange, Granularity, IsoDate } from "../domain/date-range";
import type { Totals } from "../domain/metrics";

/**
 * Vertrag zwischen Query-Layer und Datenhaltung.
 * Phase 2: nur die Demo-Implementierung. Phase 5: Live-Implementierung auf
 * analytics_daily / analytics_sessions (Supabase) – UI bleibt unverändert.
 */

export const BREAKDOWN_DIMENSIONS = [
  "channel",
  "source",
  "page",
  "entry_page",
  "country",
  "device",
  "browser",
  "os",
  "goal",
] as const;

export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export type BreakdownRow = {
  key: string;
  /** Anzeigename, falls die Datenquelle ihn kennt (z. B. Zielname). */
  label?: string;
  visitors: number;
  pageviews: number;
  conversions: number;
};

export const DURATION_BUCKETS = ["lt10", "10_30", "30_60", "60_180", "180_600", "gt600"] as const;
export const DEPTH_BUCKETS = ["1", "2", "3_4", "5_9", "10p"] as const;

export type SessionDistribution = {
  duration: { key: (typeof DURATION_BUCKETS)[number]; sessions: number }[];
  depth: { key: (typeof DEPTH_BUCKETS)[number]; sessions: number }[];
};

export type TimeseriesPoint = { bucket: IsoDate; range: DateRange; totals: Totals };

/** Welche Kennzahlen die Quelle tatsächlich liefern kann – fehlende werden als „nicht verfügbar“ gezeigt. */
export type DataCapabilities = {
  conversions: boolean;
  leads: boolean;
  newReturning: boolean;
};

export const ALL_CAPABILITIES: DataCapabilities = { conversions: true, leads: true, newReturning: true };

export type AnalyticsDataSource = {
  readonly kind: "demo" | "live";
  readonly capabilities: DataCapabilities;
  getTotals(siteId: string, range: DateRange): Promise<Totals>;
  getTimeseries(siteId: string, range: DateRange, granularity: Granularity): Promise<TimeseriesPoint[]>;
  getBreakdown(
    siteId: string,
    range: DateRange,
    dimension: BreakdownDimension,
    options: { limit: number },
  ): Promise<BreakdownRow[]>;
  getSessionDistribution(siteId: string, range: DateRange): Promise<SessionDistribution>;
};
