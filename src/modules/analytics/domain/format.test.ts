import { describe, expect, it } from "vitest";
import {
  formatBucketLong,
  formatCount,
  formatCountry,
  formatDelta,
  formatDuration,
  formatDurationCompact,
  formatMetricValue,
  formatPercent,
  formatRange,
} from "./format";

// Intl verwendet geschützte Leerzeichen; für Vergleiche normalisieren.
const normalize = (value: string) => value.replace(/ | /g, " ");

describe("Zahlen", () => {
  it("formatiert deutsch mit Tausenderpunkt und kompakt ab einer Million", () => {
    expect(formatCount(27980)).toBe("27.980");
    expect(normalize(formatCount(1_234_567))).toBe("1,2 Mio.");
  });

  it("formatiert Prozent mit einer Nachkommastelle", () => {
    expect(normalize(formatPercent(0.4134))).toBe("41,3 %");
  });

  it("zeigt fehlende Werte als Gedankenstrich", () => {
    expect(formatMetricValue(null, "count")).toBe("–");
  });
});

describe("Dauer", () => {
  it("schreibt Minuten und Sekunden aus", () => {
    expect(formatDuration(104)).toBe("1 Min. 44 Sek.");
    expect(formatDuration(45)).toBe("45 Sek.");
    expect(formatDuration(120)).toBe("2 Min.");
  });

  it("hat eine kompakte Variante für Kennzahlkarten", () => {
    expect(formatDurationCompact(104)).toBe("1:44 Min.");
    expect(formatDurationCompact(65)).toBe("1:05 Min.");
    expect(formatDurationCompact(44)).toBe("44 Sek.");
  });
});

describe("Veränderungen", () => {
  it("zeigt Prozent-Kennzahlen in Prozentpunkten", () => {
    expect(normalize(formatDelta({ absolute: 0.008, relative: 0.02 }, "percent"))).toBe("+0,8 Pp.");
  });

  it("zeigt Mengen relativ mit Vorzeichen", () => {
    expect(normalize(formatDelta({ absolute: 37, relative: 0.037 }, "count"))).toBe("+3,7 %");
    expect(normalize(formatDelta({ absolute: -5, relative: null }, "count"))).toBe("-5");
  });
});

describe("Datum & Länder", () => {
  it("formatiert Zeiträume", () => {
    expect(normalize(formatRange({ start: "2026-10-30", end: "2026-11-26" }))).toBe("30. Okt. – 26. Nov. 2026");
    expect(normalize(formatRange({ start: "2025-12-20", end: "2026-01-05" }))).toBe("20. Dez. 2025 – 5. Jan. 2026");
  });

  it("beschriftet Tage mit Wochentag", () => {
    expect(normalize(formatBucketLong({ start: "2026-11-11", end: "2026-11-11" }, "day"))).toBe("Mi., 11. Nov.");
  });

  it("übersetzt Ländercodes", () => {
    expect(formatCountry("DE")).toBe("Deutschland");
    expect(formatCountry("ch")).toBe("Schweiz");
  });
});
