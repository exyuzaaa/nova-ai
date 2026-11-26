"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { METRICS, type MetricKey } from "../../domain/metrics";
import { formatMetricValue } from "../../domain/format";
import type { KpiData, SeriesPoint } from "../../server/queries/dashboard-types";
import { ChartFrame, LegendLine } from "../charts/chart-frame";
import { SeriesTable } from "../charts/series-table";
import { TimeseriesChart } from "../charts/timeseries-chart";
import { DeltaIndicator } from "../components/delta-indicator";

/** Trennhinweise (weiche Trennstriche) für lange Beschriftungen in schmalen Kacheln. */
const HYPHENATED_LABELS: Partial<Record<MetricKey, string>> = {
  avgSessionDuration: "Ø\u00a0Sitzungs\u00addauer",
  returningVisitors: "Wieder\u00adkehrende Besucher",
  pageviews: "Seiten\u00adaufrufe",
};

const KPI_GROUPS: { label: string; metrics: MetricKey[] }[] = [
  { label: "Reichweite", metrics: ["visitors", "sessions", "pageviews"] },
  { label: "Zielgruppe", metrics: ["newVisitors", "returningVisitors", "avgSessionDuration"] },
  { label: "Qualität & Ergebnis", metrics: ["bounceRate", "conversionRate", "leads"] },
];

function KpiCell({
  kpi,
  selected,
  compareLabel,
  onSelect,
}: {
  kpi: KpiData;
  selected: boolean;
  compareLabel: string | null;
  onSelect: () => void;
}) {
  const metric = METRICS[kpi.key];
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col gap-1 rounded-lg p-3 transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={metric.label}
        className="line-clamp-2 min-h-8 min-w-0 text-left text-xs leading-4 font-medium hyphens-auto text-muted-foreground after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
      >
        {HYPHENATED_LABELS[kpi.key] ?? metric.label}
      </button>
      <p className="truncate text-xl font-semibold tracking-tight" title={formatMetricValue(kpi.value, metric.format)}>
        {formatMetricValue(kpi.value, metric.format, { compact: true })}
      </p>
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-h-4 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {kpi.delta ? (
            <>
              <DeltaIndicator delta={kpi.delta} tone={kpi.tone} format={metric.format} />
              {compareLabel && <span className="whitespace-nowrap">vs. {compareLabel}</span>}
            </>
          ) : kpi.value === null ? (
            <span>Nicht verfügbar</span>
          ) : compareLabel ? (
            <span>Kein Vergleichswert</span>
          ) : null}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="relative z-10 -my-1 -mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={`Definition: ${metric.label}`}
            >
              <Info className="size-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{metric.description}</TooltipContent>
        </Tooltip>
      </div>
      {selected && <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
    </div>
  );
}

/** Kennzahlen + Hauptdiagramm. Ein Klick auf eine Kennzahl zeigt deren Verlauf. */
export function KpiOverview({
  kpis,
  series,
  compareLabel,
  rangeLabel,
}: {
  kpis: KpiData[];
  series: SeriesPoint[];
  compareLabel: string | null;
  rangeLabel: string;
}) {
  const [selected, setSelected] = useState<MetricKey>("visitors");
  const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi]));
  const hasPrevious = series.some((point) => point.previous !== null);
  const metric = METRICS[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {KPI_GROUPS.map((group) => (
          <section key={group.label} aria-label={group.label} className="rounded-xl border bg-card p-1.5">
            <h2 className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</h2>
            <div className="grid grid-cols-3 gap-0.5">
              {group.metrics.map((key) => {
                const kpi = byKey.get(key);
                return kpi ? (
                  <KpiCell
                    key={key}
                    kpi={kpi}
                    selected={selected === key}
                    compareLabel={compareLabel}
                    onSelect={() => setSelected(key)}
                  />
                ) : null;
              })}
            </div>
          </section>
        ))}
      </div>

      <ChartFrame
        title={`${metric.label} im Verlauf`}
        description="Kennzahl oben auswählen, um ihren Verlauf zu sehen."
        legend={
          hasPrevious ? (
            <div className="flex flex-wrap gap-4">
              <LegendLine color="var(--series-1)" label={rangeLabel} />
              <LegendLine color="var(--chart-compare)" label={compareLabel ?? "Vergleich"} />
            </div>
          ) : null
        }
        chart={<TimeseriesChart points={series} metric={selected} height={280} />}
        table={<SeriesTable points={series} metrics={[selected]} />}
      />
    </div>
  );
}
