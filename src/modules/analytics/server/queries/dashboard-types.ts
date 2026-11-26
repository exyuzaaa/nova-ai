import type { CompareMode, DateRange, Granularity, RangePreset } from "../../domain/date-range";
import type { Delta, DeltaTone, MetricKey, MetricValues } from "../../domain/metrics";

/** Serialisierbare Dashboard-Daten (Server → Client). Reine Typen, kein Server-Code. */

export type KpiData = {
  key: MetricKey;
  value: number | null;
  previous: number | null;
  delta: Delta | null;
  tone: DeltaTone;
};

export type SeriesPoint = {
  key: string;
  axisLabel: string;
  label: string;
  current: MetricValues;
  previous: MetricValues | null;
  previousLabel: string | null;
};

export type BreakdownItem = {
  key: string;
  label: string;
  value: number;
  /** Anteil an der Gesamtsumme (0–1). */
  share: number;
  secondary?: number;
};

export type BreakdownData = {
  valueLabel: string;
  secondaryLabel?: string;
  total: number;
  items: BreakdownItem[];
};

export type DashboardData = {
  site: { id: string; name: string; domain: string; isDemo: boolean };
  preset: RangePreset;
  compare: CompareMode;
  range: DateRange;
  compareRange: DateRange | null;
  granularity: Granularity;
  kpis: KpiData[];
  series: SeriesPoint[];
  breakdowns: {
    channels: BreakdownData;
    sources: BreakdownData;
    pages: BreakdownData;
    entryPages: BreakdownData;
    countries: BreakdownData;
    devices: BreakdownData;
    browsers: BreakdownData;
    operatingSystems: BreakdownData;
    goals: BreakdownData;
  };
};
