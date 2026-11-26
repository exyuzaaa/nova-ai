import type { DateRange, Granularity, IsoDate } from "./date-range";
import type { MetricFormat } from "./metrics";

const LOCALE = "de-DE";

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percentFormat = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const signedPercentFormat = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const signedIntegerFormat = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/** Zahlen bis 999.999 voll ausgeschrieben, darüber kompakt (1,2 Mio.). */
export const formatCount = (value: number): string =>
  Math.abs(value) >= 1_000_000 ? compactFormat.format(value) : integerFormat.format(value);

/** Achsenbeschriftung: ab 10.000 kompakt, darunter voll. */
export const formatAxisCount = (value: number): string =>
  Math.abs(value) >= 10_000 ? compactFormat.format(value) : integerFormat.format(value);

export const formatPercent = (value: number): string => percentFormat.format(value);

/** 134 s → "2 Min. 14 Sek."; unter einer Minute nur Sekunden. */
export const formatDuration = (seconds: number): string => {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (minutes === 0) return `${rest} Sek.`;
  if (rest === 0) return `${minutes} Min.`;
  return `${minutes} Min. ${rest} Sek.`;
};

/** Kompakte Dauer für Kennzahlkarten und Achsen: 104 s → "1:44 Min.", 44 s → "44 Sek." */
export const formatDurationCompact = (seconds: number): string => {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} Sek.`;
  const minutes = Math.floor(rounded / 60);
  const rest = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${rest} Min.`;
};

export const formatMetricValue = (
  value: number | null,
  format: MetricFormat,
  options: { compact?: boolean } = {},
): string => {
  if (value === null) return "–";
  switch (format) {
    case "count":
      return formatCount(value);
    case "percent":
      return formatPercent(value);
    case "duration":
      return options.compact ? formatDurationCompact(value) : formatDuration(value);
  }
};

/** Veränderung: bei Prozent-Kennzahlen in Prozentpunkten, sonst relativ. */
export const formatDelta = (
  delta: { absolute: number; relative: number | null },
  format: MetricFormat,
): string => {
  if (format === "percent") {
    const points = delta.absolute * 100;
    const formatted = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      signDisplay: "exceptZero",
    }).format(points);
    return `${formatted} Pp.`;
  }
  if (delta.relative === null) return signedIntegerFormat.format(delta.absolute);
  return signedPercentFormat.format(delta.relative);
};

const toDate = (iso: IsoDate) => new Date(`${iso}T00:00:00Z`);

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
const weekdayDayMonth = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const formatRange = ({ start, end }: DateRange): string => {
  if (start === end) return dayMonthYear.format(toDate(start));
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const startLabel = sameYear ? dayMonth.format(toDate(start)) : dayMonthYear.format(toDate(start));
  return `${startLabel} – ${dayMonthYear.format(toDate(end))}`;
};

/** Kurze Achsenbeschriftung eines Buckets. */
export const formatBucketAxis = (key: IsoDate, granularity: Granularity): string =>
  granularity === "month" ? monthYear.format(toDate(key)) : dayMonth.format(toDate(key));

/** Ausführliche Beschriftung (Tooltip, Tabelle). */
export const formatBucketLong = (range: DateRange, granularity: Granularity): string => {
  if (granularity === "day") return weekdayDayMonth.format(toDate(range.start));
  if (granularity === "month") return monthYear.format(toDate(range.start));
  return formatRange(range);
};

const regionNames = new Intl.DisplayNames([LOCALE], { type: "region" });

export const formatCountry = (code: string): string => {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};
