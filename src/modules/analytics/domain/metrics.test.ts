import { describe, expect, it } from "vitest";
import { computeDelta, deltaTone, deriveMetrics, emptyTotals, METRIC_KEYS, METRICS } from "./metrics";

describe("deriveMetrics", () => {
  it("berechnet Verhältnisse aus Bausteinen", () => {
    const metrics = deriveMetrics({
      ...emptyTotals(),
      visitors: 800,
      sessions: 1000,
      bounces: 400,
      engagementMs: 90_000_000,
      convertedSessions: 25,
      leads: 12,
    });
    expect(metrics.bounceRate).toBeCloseTo(0.4);
    expect(metrics.conversionRate).toBeCloseTo(0.025);
    expect(metrics.avgSessionDuration).toBeCloseTo(90);
    expect(metrics.leads).toBe(12);
  });

  it("liefert null statt NaN ohne Sessions", () => {
    const metrics = deriveMetrics(emptyTotals());
    expect(metrics.bounceRate).toBeNull();
    expect(metrics.conversionRate).toBeNull();
    expect(metrics.avgSessionDuration).toBeNull();
  });

  it("reicht fehlende Neu/Wiederkehrend-Werte als null durch (cookieless)", () => {
    const metrics = deriveMetrics({ ...emptyTotals(), newVisitors: null, returningVisitors: null });
    expect(metrics.newVisitors).toBeNull();
    expect(metrics.returningVisitors).toBeNull();
  });

  it("definiert alle 9 Kennzahlen des Briefings", () => {
    expect(METRIC_KEYS).toHaveLength(9);
    for (const key of METRIC_KEYS) expect(METRICS[key].label.length).toBeGreaterThan(0);
  });
});

describe("computeDelta", () => {
  it("berechnet relative Veränderungen", () => {
    expect(computeDelta(110, 100)).toEqual({ absolute: 10, relative: 0.1, direction: "up" });
    expect(computeDelta(90, 100)?.direction).toBe("down");
  });

  it("hat ohne Vorwert keine relative Veränderung", () => {
    expect(computeDelta(5, 0)).toEqual({ absolute: 5, relative: null, direction: "up" });
    expect(computeDelta(null, 3)).toBeNull();
  });

  it("zeigt bei Prozent-Kennzahlen unter 0,05 Prozentpunkten keine Richtung", () => {
    // 2,80 % → 2,84 %: relativ +1,4 %, aber nur 0,04 Pp. → als unverändert anzeigen
    expect(computeDelta(0.0284, 0.028, "percent")?.direction).toBe("flat");
    expect(computeDelta(0.029, 0.028, "percent")?.direction).toBe("up");
  });
});

describe("deltaTone", () => {
  it("wertet steigende Absprungrate als Verschlechterung", () => {
    expect(deltaTone("bounceRate", computeDelta(0.45, 0.4, "percent"))).toBe("negative");
    expect(deltaTone("bounceRate", computeDelta(0.35, 0.4, "percent"))).toBe("positive");
  });

  it("wertet mehr Besucher als Verbesserung und gleich als neutral", () => {
    expect(deltaTone("visitors", computeDelta(120, 100))).toBe("positive");
    expect(deltaTone("visitors", computeDelta(100, 100))).toBe("neutral");
    expect(deltaTone("visitors", null)).toBe("neutral");
  });
});
