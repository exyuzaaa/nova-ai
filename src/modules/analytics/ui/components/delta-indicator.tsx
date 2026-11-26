import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Delta, DeltaTone, MetricFormat } from "../../domain/metrics";
import { formatDelta } from "../../domain/format";

const TONE_CLASS: Record<DeltaTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-muted-foreground",
};

const TONE_LABEL: Record<DeltaTone, string> = {
  positive: "Verbesserung",
  negative: "Verschlechterung",
  neutral: "unverändert",
};

/** Veränderung mit Pfeil, Vorzeichen und Text – Bedeutung nie nur über Farbe. */
export function DeltaIndicator({
  delta,
  tone,
  format,
  className,
}: {
  delta: Delta;
  tone: DeltaTone;
  format: MetricFormat;
  className?: string;
}) {
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : ArrowRight;
  const formatted = formatDelta(delta, format);
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", TONE_CLASS[tone], className)}>
      <Icon className="size-3.5" aria-hidden />
      {formatted}
      <span className="sr-only"> ({TONE_LABEL[tone]})</span>
    </span>
  );
}
