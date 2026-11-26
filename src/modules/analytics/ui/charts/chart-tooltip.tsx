/** Tooltip-Inhalt: Wert führt, Bezeichnung folgt; Linien- bzw. Flächenschlüssel statt Textfarbe. */
export type TooltipRow = { key: string; color: string; value: string; label: string; shape: "line" | "rect" };

export function ChartTooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1.5 text-xs text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={row.shape === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]"}
              style={{ background: row.color }}
            />
            <span className="text-sm font-semibold tabular-nums">{row.value}</span>
            <span className="text-xs text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
