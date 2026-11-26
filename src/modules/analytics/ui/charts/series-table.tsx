import { METRICS, type MetricKey } from "../../domain/metrics";
import { formatMetricValue } from "../../domain/format";
import type { SeriesPoint } from "../../server/queries/dashboard-types";

/** Tabellenansicht einer Zeitreihe (inkl. Vergleichszeitraum, falls vorhanden). */
export function SeriesTable({ points, metrics }: { points: SeriesPoint[]; metrics: MetricKey[] }) {
  const hasPrevious = points.some((point) => point.previous !== null);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{metrics.map((metric) => METRICS[metric].label).join(", ")} je Zeitabschnitt</caption>
      <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-2 pr-3 text-left font-medium">Zeitraum</th>
          {metrics.map((metric) => (
            <th key={metric} scope="col" className="py-2 pl-3 text-right font-medium">
              {METRICS[metric].label}
            </th>
          ))}
          {hasPrevious &&
            metrics.map((metric) => (
              <th key={`prev-${metric}`} scope="col" className="py-2 pl-3 text-right font-medium">
                Vergleich
              </th>
            ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {points.map((point) => (
          <tr key={point.key} className="border-b last:border-0">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal">
              {point.label}
            </th>
            {metrics.map((metric) => (
              <td key={metric} className="py-1.5 pl-3 text-right">
                {formatMetricValue(point.current[metric], METRICS[metric].format)}
              </td>
            ))}
            {hasPrevious &&
              metrics.map((metric) => (
                <td key={`prev-${metric}`} className="py-1.5 pl-3 text-right text-muted-foreground">
                  {point.previous ? formatMetricValue(point.previous[metric], METRICS[metric].format) : "–"}
                </td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
