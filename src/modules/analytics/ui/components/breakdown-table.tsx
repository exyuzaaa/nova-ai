import { formatCount, formatPercent } from "../../domain/format";
import type { BreakdownData } from "../../server/queries/dashboard-types";

/**
 * Aufschlüsselung als echte Tabelle; der zurückgenommene Balken hinter der
 * Bezeichnung zeigt das Verhältnis zum größten Wert.
 */
export function BreakdownTable({
  data,
  dimensionLabel,
  emptyText = "Keine Daten im gewählten Zeitraum.",
  mono = false,
}: {
  data: BreakdownData;
  dimensionLabel: string;
  emptyText?: string;
  mono?: boolean;
}) {
  if (data.items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...data.items.map((item) => item.value), 1);

  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">
        {dimensionLabel} nach {data.valueLabel}
      </caption>
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="pb-2 text-left font-medium">{dimensionLabel}</th>
          {data.secondaryLabel && (
            <th scope="col" className="hidden w-20 pb-2 text-right font-medium sm:table-cell">
              {data.secondaryLabel}
            </th>
          )}
          <th scope="col" className="w-20 pb-2 text-right font-medium">{data.valueLabel}</th>
          <th scope="col" className="w-16 pb-2 text-right font-medium">Anteil</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {data.items.map((item) => (
          <tr key={item.key}>
            <th scope="row" className="py-0.5 pr-3 text-left font-normal">
              <div className="relative flex h-8 items-center rounded-[4px] px-2">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-[4px] bg-[color-mix(in_oklab,var(--series-1)_14%,transparent)]"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
                <span className={`relative truncate ${mono ? "font-mono text-[13px]" : ""}`} title={item.label}>
                  {item.label}
                </span>
              </div>
            </th>
            {data.secondaryLabel && (
              <td className="hidden py-0.5 text-right text-muted-foreground sm:table-cell">
                {item.secondary !== undefined ? formatCount(item.secondary) : "–"}
              </td>
            )}
            <td className="py-0.5 text-right font-medium">{formatCount(item.value)}</td>
            <td className="py-0.5 text-right text-muted-foreground">{formatPercent(item.share)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
