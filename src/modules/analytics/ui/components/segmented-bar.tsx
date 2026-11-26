import { formatCount, formatPercent } from "../../domain/format";
import type { BreakdownItem } from "../../server/queries/dashboard-types";

const SLOT_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
/**
 * Beschriftung im Segment nur, wenn sie sicher hineinpasst. Schrift fast schwarz:
 * auf allen vier Reihenfarben ≥ 4,5:1 (Weiß läge in Hell bei nur 2,5–4,1:1).
 */
const MIN_LABEL_SHARE = 0.1;

/**
 * Hoher segmentierter Balken (ein Ganzes, ≤ 4 Teile): Anteil im Segment,
 * Legende mit Namen und Werten darunter. Kein Donut.
 */
export function SegmentedBar({ items, label }: { items: BreakdownItem[]; label: string }) {
  const parts = items.slice(0, SLOT_COLORS.length).filter((item) => item.value > 0);
  const summary = parts.map((item) => `${item.label} ${formatPercent(item.share)}`).join(", ");

  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={`${label}: ${summary}`} className="flex h-7 w-full gap-0.5">
        {parts.map((item, index) => (
          <div
            key={item.key}
            title={`${item.label}: ${formatCount(item.value)} (${formatPercent(item.share)})`}
            className="flex h-full items-center overflow-hidden rounded-[4px] px-2 text-xs font-semibold text-[#0b0b0b]"
            style={{ flexGrow: item.value, flexBasis: 0, background: SLOT_COLORS[index] }}
          >
            {item.share >= MIN_LABEL_SHARE && <span aria-hidden>{formatPercent(item.share)}</span>}
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((item, index) => (
          <li key={item.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: SLOT_COLORS[index] }} />
            <span className="text-foreground">{item.label}</span>
            <span className="tabular-nums">{formatCount(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
