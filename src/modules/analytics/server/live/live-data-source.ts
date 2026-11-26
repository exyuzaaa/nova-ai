import type { DateRange, Granularity } from "../../domain/date-range";
import { bucketsFor } from "../../domain/date-range";
import { emptyTotals, type Totals } from "../../domain/metrics";
import type { AnalyticsDataSource, BreakdownDimension, BreakdownRow, TimeseriesPoint } from "../data-source";

/**
 * LIVE-DATENQUELLE – liest echte Besucherdaten über die Auswertungsfunktionen
 * der Datenbank (analytics.site_daily_stats / site_breakdown). Zugriff wird in
 * der Datenbank für den angemeldeten Nutzer geprüft.
 *
 * Noch nicht verfügbar (ehrlich als „nicht verfügbar“ gekennzeichnet):
 * Conversions (Ziele, Phase 8), Leads (CRM, Phase 9), neu/wiederkehrend (Einwilligungsmodus).
 */
export type DailyStatsRow = {
  day: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  bounces: number;
  engagement_ms: number;
};

export type BreakdownRpcRow = { key: string; visitors: number; pageviews: number };

/** Minimale Schnittstelle zum Datenbank-Client – erleichtert Tests. */
export type ReportingClient = {
  dailyStats(siteId: string, start: string, end: string): Promise<DailyStatsRow[]>;
  breakdown(siteId: string, start: string, end: string, dimension: string, limit: number): Promise<BreakdownRpcRow[]>;
};

const SUPPORTED_BREAKDOWNS: BreakdownDimension[] = ["channel", "source", "page", "entry_page", "country", "device", "browser", "os"];

/** Additive Summen; Besucher sind im cookielosen Modus je Tag eindeutig und daher summierbar. */
export const sumDays = (rows: DailyStatsRow[]): Totals => {
  const totals = emptyTotals();
  for (const row of rows) {
    totals.visitors += Number(row.visitors);
    totals.sessions += Number(row.sessions);
    totals.pageviews += Number(row.pageviews);
    totals.bounces += Number(row.bounces);
    totals.engagementMs += Number(row.engagement_ms);
  }
  return { ...totals, newVisitors: null, returningVisitors: null };
};

export const createLiveDataSource = (client: ReportingClient): AnalyticsDataSource => {
  const cache = new Map<string, Promise<DailyStatsRow[]>>();
  const days = (siteId: string, range: DateRange) => {
    const key = `${siteId}|${range.start}|${range.end}`;
    if (!cache.has(key)) cache.set(key, client.dailyStats(siteId, range.start, range.end));
    return cache.get(key)!;
  };

  return {
    kind: "live",
    capabilities: { conversions: false, leads: false, newReturning: false },

    async getTotals(siteId, range) {
      return sumDays(await days(siteId, range));
    },

    async getTimeseries(siteId, range, granularity: Granularity): Promise<TimeseriesPoint[]> {
      const rows = await days(siteId, range);
      return bucketsFor(range, granularity).map((bucket) => ({
        bucket: bucket.key,
        range: bucket.range,
        totals: sumDays(rows.filter((row) => row.day >= bucket.range.start && row.day <= bucket.range.end)),
      }));
    },

    async getBreakdown(siteId, range, dimension, { limit }): Promise<BreakdownRow[]> {
      if (!SUPPORTED_BREAKDOWNS.includes(dimension)) return [];
      const rows = await client.breakdown(siteId, range.start, range.end, dimension, limit);
      return rows.map((row) => ({
        key: row.key,
        visitors: Number(row.visitors),
        pageviews: Number(row.pageviews),
        conversions: 0,
      }));
    },
  };
};
