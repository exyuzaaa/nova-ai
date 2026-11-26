"use client";

import { useId, useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type View = "chart" | "table";

/**
 * Karte für ein Diagramm mit umschaltbarer Tabellenansicht.
 * Die Tabelle ist die barrierefreie Alternative und hält alle Werte ohne Hover erreichbar.
 */
export function ChartFrame({
  title,
  description,
  legend,
  chart,
  table,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  legend?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-medium">
            {title}
          </h2>
          {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={view}
          onValueChange={(value) => value && setView(value as View)}
          aria-label={`Ansicht für ${title}`}
        >
          <ToggleGroupItem value="chart" aria-label="Diagramm" title="Diagramm">
            <BarChart3 className="size-3.5" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Tabelle" title="Tabelle">
            <Table2 className="size-3.5" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </header>
      {view === "chart" ? (
        <>
          {legend}
          {chart}
        </>
      ) : (
        <div className="max-h-80 overflow-auto">{table}</div>
      )}
    </section>
  );
}

export function LegendLine({ color, label }: { color: string; label: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function LegendSwatch({ color, label }: { color: string; label: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </span>
  );
}
