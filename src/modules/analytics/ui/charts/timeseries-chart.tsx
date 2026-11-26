"use client";

import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { METRICS, type MetricKey } from "../../domain/metrics";
import { formatAxisCount, formatDurationCompact, formatMetricValue } from "../../domain/format";
import type { SeriesPoint } from "../../server/queries/dashboard-types";
import { ChartTooltipCard } from "./chart-tooltip";

type Datum = {
  axisLabel: string;
  label: string;
  previousLabel: string | null;
  current: number | null;
  previous: number | null;
};

const percentAxis = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 1 });

const axisFormatter = (metric: MetricKey) => (value: number) => {
  switch (METRICS[metric].format) {
    case "count":
      return formatAxisCount(value);
    case "percent":
      return percentAxis.format(value);
    case "duration":
      return formatDurationCompact(value);
  }
};

export const toDatums = (points: SeriesPoint[], metric: MetricKey): Datum[] =>
  points.map((point) => ({
    axisLabel: point.axisLabel,
    label: point.label,
    previousLabel: point.previousLabel,
    current: point.current[metric],
    previous: point.previous?.[metric] ?? null,
  }));

function TimeseriesTooltip({ active, payload, metric }: TooltipContentProps & { metric: MetricKey }) {
  const datum = payload?.[0]?.payload as Datum | undefined;
  if (!active || !datum) return null;
  const format = METRICS[metric].format;
  const rows = [
    {
      key: "current",
      color: "var(--series-1)",
      value: formatMetricValue(datum.current, format),
      label: datum.label,
      shape: "line" as const,
    },
  ];
  if (datum.previousLabel) {
    rows.push({
      key: "previous",
      color: "var(--chart-compare)",
      value: formatMetricValue(datum.previous, format),
      label: datum.previousLabel,
      shape: "line",
    });
  }
  return <ChartTooltipCard title={METRICS[metric].label} rows={rows} />;
}

/** Zeitreihe einer Kennzahl; Vergleichszeitraum als zurückgenommene graue Linie. */
export function TimeseriesChart({
  points,
  metric,
  height = 260,
}: {
  points: SeriesPoint[];
  metric: MetricKey;
  height?: number;
}) {
  const data = toDatums(points, metric);
  const hasPrevious = data.some((datum) => datum.previousLabel !== null);
  const gradientId = `area-${metric}`;

  return (
    <figure aria-label={`${METRICS[metric].label} im Zeitverlauf`} className="m-0">
      <ComposedChart
        data={data}
        responsive
        style={{ width: "100%", height }}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="axisLabel"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tick={{ fill: "var(--chart-ink)", fontSize: 12 }}
          minTickGap={28}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-ink)", fontSize: 12 }}
          tickFormatter={axisFormatter(metric)}
          width={52}
          allowDecimals={METRICS[metric].format !== "count"}
        />
        <Tooltip
          cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          content={(props) => <TimeseriesTooltip {...props} metric={metric} />}
          isAnimationActive={false}
        />
        {hasPrevious && (
          <Line
            dataKey="previous"
            name="Vergleichszeitraum"
            stroke="var(--chart-compare)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--chart-compare)" }}
            isAnimationActive={false}
          />
        )}
        <Area
          dataKey="current"
          name="Zeitraum"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--series-1)" }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </figure>
  );
}
