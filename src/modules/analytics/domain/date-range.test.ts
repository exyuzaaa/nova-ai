import { describe, expect, it } from "vitest";
import {
  bucketsFor,
  compareRange,
  granularityFor,
  parseDashboardFilters,
  rangeLength,
  resolveRange,
  todayInTimeZone,
} from "./date-range";

describe("resolveRange", () => {
  it("liefert für 28 Tage genau 28 Kalendertage inklusive heute", () => {
    const range = resolveRange("28d", "2026-11-26");
    expect(range).toEqual({ start: "2026-10-30", end: "2026-11-26" });
    expect(rangeLength(range)).toBe(28);
  });

  it("berechnet den letzten Monat inklusive Schaltjahr", () => {
    expect(resolveRange("last_month", "2026-03-15")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(resolveRange("last_month", "2024-03-10")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(resolveRange("last_month", "2026-01-05")).toEqual({ start: "2025-12-01", end: "2025-12-31" });
  });

  it("liefert für 12 Monate 365 Tage", () => {
    const range = resolveRange("12m", "2026-11-26");
    expect(range).toEqual({ start: "2025-11-27", end: "2026-11-26" });
    expect(rangeLength(range)).toBe(365);
  });

  it("beginnt 'Dieser Monat' am Monatsersten", () => {
    expect(resolveRange("mtd", "2026-11-26")).toEqual({ start: "2026-11-01", end: "2026-11-26" });
  });
});

describe("compareRange", () => {
  it("nimmt den gleich langen, unmittelbar vorangehenden Zeitraum", () => {
    expect(compareRange({ start: "2026-10-30", end: "2026-11-26" }, "previous")).toEqual({
      start: "2026-10-02",
      end: "2026-10-29",
    });
  });

  it("verschiebt beim Vorjahr um ein Kalenderjahr (29.02. → 28.02.)", () => {
    expect(compareRange({ start: "2024-02-29", end: "2024-03-07" }, "year")).toEqual({
      start: "2023-02-28",
      end: "2023-03-07",
    });
  });

  it("liefert ohne Vergleich null", () => {
    expect(compareRange({ start: "2026-11-01", end: "2026-11-26" }, "none")).toBeNull();
  });
});

describe("Granularität und Buckets", () => {
  it("wählt Tag/Woche/Monat nach Länge", () => {
    expect(granularityFor(resolveRange("90d", "2026-11-26"))).toBe("day");
    expect(granularityFor({ start: "2026-06-01", end: "2026-11-26" })).toBe("week");
    expect(granularityFor(resolveRange("12m", "2026-11-26"))).toBe("month");
  });

  it("deckt jeden Tag genau einmal ab und beginnt Wochen montags", () => {
    const range = { start: "2026-11-04", end: "2026-11-26" }; // Mittwoch bis Donnerstag
    const buckets = bucketsFor(range, "week");
    expect(buckets[0]).toEqual({ key: "2026-11-02", range: { start: "2026-11-04", end: "2026-11-08" } });
    expect(buckets.map((bucket) => bucket.key)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    const covered = buckets.reduce((sum, bucket) => sum + rangeLength(bucket.range), 0);
    expect(covered).toBe(rangeLength(range));
  });
});

describe("todayInTimeZone", () => {
  it("berücksichtigt die Zeitzone der Website", () => {
    const lateEvening = new Date("2026-11-26T23:30:00Z");
    expect(todayInTimeZone("Europe/Berlin", lateEvening)).toBe("2026-11-27");
    expect(todayInTimeZone("UTC", lateEvening)).toBe("2026-11-26");
  });
});

describe("parseDashboardFilters", () => {
  it("übernimmt gültige Werte", () => {
    expect(parseDashboardFilters({ range: "7d", compare: "year" })).toEqual({ preset: "7d", compare: "year" });
  });

  it("fällt bei ungültigen oder fehlenden Werten auf Standardwerte zurück", () => {
    expect(parseDashboardFilters({ range: "'; drop table", compare: undefined })).toEqual({
      preset: "28d",
      compare: "previous",
    });
  });

  it("nimmt bei Mehrfachwerten den ersten", () => {
    expect(parseDashboardFilters({ range: ["90d", "7d"] }).preset).toBe("90d");
  });
});
