import { describe, expect, it, vi } from "vitest";
import { getDashboardData } from "../queries/dashboard";
import { DEMO_SITE, type Site } from "../sites";
import { createLiveDataSource, sumDays, type DailyStatsRow, type ReportingClient } from "./live-data-source";

const SITE: Site = { ...DEMO_SITE, id: "site-1", isDemo: false, role: "viewer" };

const day = (date: string, visitors: number, sessions: number, pageviews: number, bounces: number, engagement: number): DailyStatsRow => ({
  day: date,
  visitors,
  sessions,
  pageviews,
  bounces,
  engagement_ms: engagement,
});

const fakeClient = (rows: DailyStatsRow[]): ReportingClient & { dailyStats: ReturnType<typeof vi.fn> } => ({
  dailyStats: vi.fn(async (_site: string, start: string, end: string) => rows.filter((row) => row.day >= start && row.day <= end)),
  breakdown: vi.fn(async (_site: string, _start: string, _end: string, dimension: string) =>
    dimension === "channel" ? [{ key: "organic_search", visitors: 3, pageviews: 5 }, { key: "direct", visitors: 1, pageviews: 1 }] : [],
  ),
  distribution: vi.fn(async () => [
    { kind: "duration", bucket: "lt10", sessions: 2 },
    { kind: "depth", bucket: "2", sessions: 1 },
  ]),
});

describe("Live-Datenquelle", () => {
  it("summiert Tageswerte; neu/wiederkehrend bleibt unbekannt", () => {
    const totals = sumDays([day("2026-11-01", 2, 3, 5, 1, 1000), day("2026-11-02", 1, 1, 1, 1, 0)]);
    expect(totals).toMatchObject({ visitors: 3, sessions: 4, pageviews: 6, bounces: 2, engagementMs: 1000, newVisitors: null });
  });

  it("bildet Wochen-Buckets aus Tageswerten und fragt die Datenbank nur einmal je Zeitraum", async () => {
    const client = fakeClient([day("2026-11-02", 1, 1, 1, 0, 0), day("2026-11-09", 2, 2, 4, 1, 0)]);
    const source = createLiveDataSource(client);
    const range = { start: "2026-11-02", end: "2026-11-15" };
    const [totals, weeks] = await Promise.all([source.getTotals("s", range), source.getTimeseries("s", range, "week")]);
    expect(totals.pageviews).toBe(5);
    expect(weeks.map((week) => week.totals.pageviews)).toEqual([1, 4]);
    expect(client.dailyStats).toHaveBeenCalledTimes(1);
  });

  it("ergänzt fehlende Verteilungs-Klassen mit 0", async () => {
    const source = createLiveDataSource(fakeClient([]));
    const distribution = await source.getSessionDistribution("s", { start: "2026-11-01", end: "2026-11-02" });
    expect(distribution.duration).toHaveLength(6);
    expect(distribution.duration[0]).toEqual({ key: "lt10", sessions: 2 });
    expect(distribution.depth.map((row) => row.sessions)).toEqual([0, 1, 0, 0, 0]);
  });

  it("liefert keine erfundenen Ziele", async () => {
    const source = createLiveDataSource(fakeClient([]));
    expect(await source.getBreakdown("s", { start: "2026-11-01", end: "2026-11-02" }, "goal", { limit: 8 })).toEqual([]);
  });

  it("zeigt Conversion Rate, Leads und neu/wiederkehrend als nicht verfügbar statt 0", async () => {
    const source = createLiveDataSource(fakeClient([day("2026-11-25", 4, 5, 9, 2, 60000)]));
    const data = await getDashboardData(SITE, { preset: "7d", compare: "previous" }, source, new Date("2026-11-26T12:00:00Z"));
    const kpi = Object.fromEntries(data.kpis.map((item) => [item.key, item]));
    expect(kpi.visitors.value).toBe(4);
    expect(kpi.pageviews.value).toBe(9);
    expect(kpi.bounceRate.value).toBeCloseTo(0.4);
    expect(kpi.avgSessionDuration.value).toBeCloseTo(12);
    for (const key of ["conversionRate", "leads", "newVisitors", "returningVisitors"]) {
      expect(kpi[key].value).toBeNull();
      expect(kpi[key].delta).toBeNull();
    }
    expect(data.availability).toEqual({ conversions: false, leads: false, newReturning: false });
    expect(data.breakdowns.channels.items[0]).toMatchObject({ label: "Organic Search", value: 3 });
    expect(data.series.every((point) => point.current.conversionRate === null)).toBe(true);
  });
});
