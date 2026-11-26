"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatAxisCount, formatCount } from "../../domain/format";
import type { SeriesPoint } from "../../server/queries/dashboard-types";
import { ChartTooltipCard } from "./chart-tooltip";

type Datum = { axisLabel: string; label: string; newVisitors: number; returningVisitors: number };

export const toNewReturningDatums = (points: SeriesPoint[]): Datum[] =>
  points.map((point) => ({
    axisLabel: point.axisLabel,
    label: point.label,
    newVisitors: point.current.newVisitors ?? 0,
    returningVisitors: point.current.returningVisitors ?? 0,
  }));

function NewReturningTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload as Datum | undefined;
  if (!active || !datum) return null;
  return (
    <ChartTooltipCard
      title={datum.label}
      rows={[
        { key: "new", color: "var(--series-1)", value: formatCount(datum.newVisitors), label: "Neue Besucher", shape: "rect" },
        {
          key: "returning",
          color: "var(--series-2)",
          value: formatCount(datum.returningVisitors),
          label: "Wiederkehrende Besucher",
          shape: "rect",
        },
      ]}
    />
  );
}

/** Gestapelte Säulen; 2-px-Flächenfuge trennt die Segmente. */
export function NewReturningChart({ points, height = 220 }: { points: SeriesPoint[]; height?: number }) {
  const data = toNewReturningDatums(points);
  return (
    <figure aria-label="Neue und wiederkehrende Besucher im Zeitverlauf" className="m-0">
      <BarChart
        data={data}
        responsive
        style={{ width: "100%", height }}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        barCategoryGap="20%"
      >
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
          tickFormatter={formatAxisCount}
          width={52}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={(props) => <NewReturningTooltip {...props} />}
          isAnimationActive={false}
        />
        <Bar
          dataKey="newVisitors"
          stackId="visitors"
          fill="var(--series-1)"
          stroke="var(--card)"
          strokeWidth={2}
          maxBarSize={24}
          isAnimationActive={false}
        />
        <Bar
          dataKey="returningVisitors"
          stackId="visitors"
          fill="var(--series-2)"
          stroke="var(--card)"
          strokeWidth={2}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </figure>
  );
}
