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

export type TimeseriesPoint = { bucket: IsoDate; range: DateRange; totals: Totals };

export type AnalyticsDataSource = {
  readonly kind: "demo" | "live";
  getTotals(siteId: string, range: DateRange): Promise<Totals>;
  getTimeseries(siteId: string, range: DateRange, granularity: Granularity): Promise<TimeseriesPoint[]>;
  getBreakdown(
    siteId: string,
    range: DateRange,
    dimension: BreakdownDimension,
    options: { limit: number },
  ): Promise<BreakdownRow[]>;
};
