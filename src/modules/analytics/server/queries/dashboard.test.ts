import { describe, expect, it } from "vitest";
import { demoDataSource } from "../demo/demo-data-source";
import { DEMO_SITE } from "../sites";
import { getDashboardData } from "./dashboard";

const NOW = new Date("2026-11-26T12:00:00Z");

describe("getDashboardData", () => {
  it("liefert 9 Kennzahlen, Zeitreihe mit Vergleich und alle Aufschlüsselungen", async () => {
    const data = await getDashboardData(DEMO_SITE, { preset: "28d", compare: "previous" }, demoDataSource, NOW);
    expect(data.range).toEqual({ start: "2026-10-30", end: "2026-11-26" });
    expect(data.compareRange).toEqual({ start: "2026-10-02", end: "2026-10-29" });
    expect(data.kpis).toHaveLength(9);
    expect(data.series).toHaveLength(28);
    expect(data.series.every((point) => point.previous !== null)).toBe(true);
    expect(Object.keys(data.breakdowns)).toHaveLength(9);
    expect(data.kpis.every((kpi) => kpi.delta !== null)).toBe(true);
  });

  it("verzichtet ohne Vergleich auf Deltas und Vergleichsreihe", async () => {
    const data = await getDashboardData(DEMO_SITE, { preset: "7d", compare: "none" }, demoDataSource, NOW);
    expect(data.compareRange).toBeNull();
    expect(data.kpis.every((kpi) => kpi.delta === null && kpi.tone === "neutral")).toBe(true);
    expect(data.series.every((point) => point.previous === null)).toBe(true);
  });

  it("berechnet Anteile relativ zur Gesamtsumme", async () => {
    const data = await getDashboardData(DEMO_SITE, { preset: "28d", compare: "none" }, demoDataSource, NOW);
    const channelShare = data.breakdowns.channels.items.reduce((total, item) => total + item.share, 0);
    expect(channelShare).toBeGreaterThan(0.99);
    expect(channelShare).toBeLessThan(1.01);
    expect(data.breakdowns.channels.items[0].label).toBe("Organic Search");
    expect(data.breakdowns.countries.items[0].label).toBe("Deutschland");
  });

  it("aggregiert 12 Monate monatlich", async () => {
    const data = await getDashboardData(DEMO_SITE, { preset: "12m", compare: "year" }, demoDataSource, NOW);
    expect(data.granularity).toBe("month");
    expect(data.series.length).toBe(13); // angebrochene Rand-Monate
  });

  it("verwendet den Tag in der Zeitzone der Website", async () => {
    const lateEvening = new Date("2026-11-26T23:30:00Z");
    const data = await getDashboardData(DEMO_SITE, { preset: "7d", compare: "none" }, demoDataSource, lateEvening);
    expect(data.range.end).toBe("2026-11-27");
  });
});
