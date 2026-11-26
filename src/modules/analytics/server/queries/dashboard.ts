import "server-only";
import { CHANNEL_LABELS, DEVICE_LABELS, isTrafficChannel } from "../../domain/channels";
import {
  compareRange as getCompareRange,
  granularityFor,
  resolveRange,
  todayInTimeZone,
  type DashboardFilters,
} from "../../domain/date-range";
import {
  computeDelta,
  deltaTone,
  deriveMetrics,
  METRIC_KEYS,
  METRICS,
  type MetricValues,
  type Totals,
} from "../../domain/metrics";
import { formatBucketAxis, formatBucketLong, formatCountry } from "../../domain/format";
import type { AnalyticsDataSource, BreakdownDimension, BreakdownRow } from "../data-source";
import type { Site } from "../sites";
import type { BreakdownData, DashboardData, KpiData, SeriesPoint } from "./dashboard-types";

const BREAKDOWN_LIMIT = 8;

type BreakdownSpec = {
  dimension: BreakdownDimension;
  valueField: "visitors" | "pageviews" | "conversions";
  valueLabel: string;
  secondary?: { field: "visitors" | "pageviews"; label: string };
  label: (row: BreakdownRow) => string;
};

const labelFromKey = (row: BreakdownRow) => row.label ?? row.key;

const BREAKDOWNS = {
  channels: {
    dimension: "channel",
    valueField: "visitors",
    valueLabel: "Besucher",
    label: (row) => (isTrafficChannel(row.key) ? CHANNEL_LABELS[row.key] : row.key),
  },
  sources: { dimension: "source", valueField: "visitors", valueLabel: "Besucher", label: labelFromKey },
  pages: {
    dimension: "page",
    valueField: "pageviews",
    valueLabel: "Aufrufe",
    secondary: { field: "visitors", label: "Besucher" },
    label: labelFromKey,
  },
  entryPages: { dimension: "entry_page", valueField: "visitors", valueLabel: "Besucher", label: labelFromKey },
  countries: {
    dimension: "country",
    valueField: "visitors",
    valueLabel: "Besucher",
    label: (row) => formatCountry(row.key),
  },
  devices: {
    dimension: "device",
    valueField: "visitors",
    valueLabel: "Besucher",
    label: (row) => DEVICE_LABELS[row.key] ?? row.key,
  },
  browsers: { dimension: "browser", valueField: "visitors", valueLabel: "Besucher", label: labelFromKey },
  operatingSystems: { dimension: "os", valueField: "visitors", valueLabel: "Besucher", label: labelFromKey },
  goals: { dimension: "goal", valueField: "conversions", valueLabel: "Conversions", label: labelFromKey },
} satisfies Record<keyof DashboardData["breakdowns"], BreakdownSpec>;

/** Anteile beziehen sich auf die Gesamtsumme des Zeitraums, nicht nur auf die Top-Zeilen. */
const toBreakdown = (rows: BreakdownRow[], spec: BreakdownSpec, total: number): BreakdownData => ({
  valueLabel: spec.valueLabel,
  secondaryLabel: spec.secondary?.label,
  total,
  items: rows.map((row) => ({
    key: row.key,
    label: spec.label(row),
    value: row[spec.valueField],
    share: total > 0 ? row[spec.valueField] / total : 0,
    secondary: spec.secondary ? row[spec.secondary.field] : undefined,
  })),
});

const totalFor = (totals: Totals, field: BreakdownSpec["valueField"]): number =>
  field === "visitors" ? totals.visitors : field === "pageviews" ? totals.pageviews : totals.conversions;

export const getDashboardData = async (
  site: Site,
  filters: DashboardFilters,
  dataSource: AnalyticsDataSource,
  now: Date,
): Promise<DashboardData> => {
  const today = todayInTimeZone(site.timezone, now);
  const range = resolveRange(filters.preset, today);
  const previousRange = getCompareRange(range, filters.compare);
  const granularity = granularityFor(range);

  const breakdownEntries = Object.entries(BREAKDOWNS) as [keyof typeof BREAKDOWNS, BreakdownSpec][];

  const [totals, previousTotals, series, previousSeries, breakdownRows] = await Promise.all([
    dataSource.getTotals(site.id, range),
    previousRange ? dataSource.getTotals(site.id, previousRange) : Promise.resolve(null),
    dataSource.getTimeseries(site.id, range, granularity),
    previousRange ? dataSource.getTimeseries(site.id, previousRange, granularity) : Promise.resolve(null),
    Promise.all(
      breakdownEntries.map(([, spec]) =>
        dataSource.getBreakdown(site.id, range, spec.dimension, { limit: BREAKDOWN_LIMIT }),
      ),
    ),
  ]);

  const { capabilities } = dataSource;
  // Kennzahlen ohne Datengrundlage nie als 0 anzeigen, sondern als „nicht verfügbar“.
  const withAvailability = (values: MetricValues): MetricValues => ({
    ...values,
    conversionRate: capabilities.conversions ? values.conversionRate : null,
    leads: capabilities.leads ? values.leads : null,
    newVisitors: capabilities.newReturning ? values.newVisitors : null,
    returningVisitors: capabilities.newReturning ? values.returningVisitors : null,
  });
  const current = withAvailability(deriveMetrics(totals));
  const previous = previousTotals ? withAvailability(deriveMetrics(previousTotals)) : null;

  const kpis: KpiData[] = METRIC_KEYS.map((key) => {
    const delta = previous ? computeDelta(current[key], previous[key], METRICS[key].format) : null;
    return { key, value: current[key], previous: previous?.[key] ?? null, delta, tone: deltaTone(key, delta) };
  });

  // Vergleichsreihe wird positionsgleich ausgerichtet (Tag 1 ↔ Tag 1 usw.).
  const seriesPoints: SeriesPoint[] = series.map((point, index) => {
    const comparePoint = previousSeries?.[index] ?? null;
    return {
      key: point.bucket,
      axisLabel: formatBucketAxis(point.bucket, granularity),
      label: formatBucketLong(point.range, granularity),
      current: withAvailability(deriveMetrics(point.totals)),
      previous: comparePoint ? withAvailability(deriveMetrics(comparePoint.totals)) : null,
      previousLabel: comparePoint ? formatBucketLong(comparePoint.range, granularity) : null,
    };
  });

  const breakdowns = Object.fromEntries(
    breakdownEntries.map(([name, spec], index) => [
      name,
      toBreakdown(breakdownRows[index], spec, totalFor(totals, spec.valueField)),
    ]),
  ) as DashboardData["breakdowns"];

  return {
    site: { id: site.id, name: site.name, domain: site.domain, isDemo: site.isDemo },
    availability: { ...capabilities },
    preset: filters.preset,
    compare: filters.compare,
    range,
    compareRange: previousRange,
    granularity,
    kpis,
    series: seriesPoints,
    breakdowns,
  };
};
