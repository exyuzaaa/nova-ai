import { describe, expect, it } from "vitest";
import { enumerateDays, rangeLength } from "../../domain/date-range";
import { allocate, demoDataSource, returningDedupeFactor } from "./demo-data-source";

const SITE = "demo";
const DAY = { start: "2026-11-11", end: "2026-11-11" };
const RANGE = { start: "2026-10-30", end: "2026-11-26" };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("allocate", () => {
  it("verteilt ganzzahlig und exakt auf die Gesamtsumme", () => {
    const result = allocate(101, { a: 1, b: 1, c: 1 });
    expect(sum(Object.values(result))).toBe(101);
    expect(Object.values(result).every(Number.isInteger)).toBe(true);
  });
});

describe("Demo-Datenquelle", () => {
  it("ist deterministisch", async () => {
    const first = await demoDataSource.getTotals(SITE, RANGE);
    const second = await demoDataSource.getTotals(SITE, RANGE);
    expect(second).toEqual(first);
  });

  it("summiert Aufschlüsselungen eines Tages exakt auf die Tageswerte", async () => {
    const totals = await demoDataSource.getTotals(SITE, DAY);
    for (const dimension of ["channel", "source", "country", "device", "browser", "os", "entry_page"] as const) {
      const rows = await demoDataSource.getBreakdown(SITE, DAY, dimension, { limit: 100 });
      expect(sum(rows.map((row) => row.visitors)), dimension).toBe(totals.visitors);
    }
    const pages = await demoDataSource.getBreakdown(SITE, DAY, "page", { limit: 100 });
    expect(sum(pages.map((row) => row.pageviews))).toBe(totals.pageviews);
    const goals = await demoDataSource.getBreakdown(SITE, DAY, "goal", { limit: 100 });
    expect(sum(goals.map((row) => row.conversions))).toBe(totals.conversions);
  });

  it("hält additive Werte zwischen Zeitreihe und Gesamtwert konsistent", async () => {
    const totals = await demoDataSource.getTotals(SITE, RANGE);
    const series = await demoDataSource.getTimeseries(SITE, RANGE, "day");
    expect(series).toHaveLength(rangeLength(RANGE));
    for (const field of ["sessions", "pageviews", "bounces", "conversions", "leads", "newVisitors"] as const) {
      expect(sum(series.map((point) => point.totals[field] ?? 0)), field).toBe(totals[field]);
    }
  });

  it("zählt wiederkehrende Besucher über Zeiträume nur einmal", async () => {
    const totals = await demoDataSource.getTotals(SITE, RANGE);
    const daily = await demoDataSource.getTimeseries(SITE, RANGE, "day");
    expect(totals.visitors).toBe((totals.newVisitors ?? 0) + (totals.returningVisitors ?? 0));
    expect(totals.visitors).toBeLessThan(sum(daily.map((point) => point.totals.visitors)));
    expect(returningDedupeFactor(1)).toBe(1);
    expect(returningDedupeFactor(28)).toBeLessThan(returningDedupeFactor(7));
  });

  it("liefert plausible Kennzahlen", async () => {
    const totals = await demoDataSource.getTotals(SITE, RANGE);
    expect(totals.sessions).toBeGreaterThan(totals.visitors);
    expect(totals.bounces).toBeLessThan(totals.sessions);
    expect(totals.convertedSessions).toBeLessThanOrEqual(totals.conversions);
    expect(totals.leads).toBeLessThanOrEqual(totals.convertedSessions);
  });

  it("sortiert absteigend und beachtet das Limit", async () => {
    const rows = await demoDataSource.getBreakdown(SITE, RANGE, "country", { limit: 3 });
    expect(rows).toHaveLength(3);
    expect(rows[0].key).toBe("DE");
    expect(rows[0].visitors).toBeGreaterThanOrEqual(rows[1].visitors);
  });

  it("erzeugt Wochen-Buckets, die den Zeitraum lückenlos abdecken", async () => {
    const range = { start: "2026-06-01", end: "2026-11-26" };
    const weeks = await demoDataSource.getTimeseries(SITE, range, "week");
    const days = sum(weeks.map((point) => rangeLength(point.range)));
    expect(days).toBe(enumerateDays(range).length);
  });
});
