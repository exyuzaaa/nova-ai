"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMPARE_MODE_LABELS,
  COMPARE_MODES,
  RANGE_PRESET_LABELS,
  RANGE_PRESETS,
  type CompareMode,
  type DateRange,
  type RangePreset,
} from "../../domain/date-range";
import { formatRange } from "../../domain/format";
import { useDashboardTransition } from "./dashboard-transition";

type Props = {
  preset: RangePreset;
  compare: CompareMode;
  range: DateRange;
  compareRange: DateRange | null;
};

/** Filterzeile: eine Zeile oberhalb aller Inhalte, Zeitraum zuerst. */
export function DashboardFilters({ preset, compare, range, compareRange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { startTransition } = useDashboardTransition();

  const navigate = (next: { preset?: RangePreset; compare?: CompareMode }) => {
    const params = new URLSearchParams({
      range: next.preset ?? preset,
      compare: next.compare ?? compare,
    });
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Zeitraum: ${RANGE_PRESET_LABELS[preset]}`}>
            <CalendarDays aria-hidden />
            {RANGE_PRESET_LABELS[preset]}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Zeitraum</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preset}
            onValueChange={(value) => navigate({ preset: value as RangePreset })}
          >
            {RANGE_PRESETS.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {RANGE_PRESET_LABELS[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Vergleich: ${COMPARE_MODE_LABELS[compare]}`}>
            <GitCompareArrows aria-hidden />
            {COMPARE_MODE_LABELS[compare]}
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Vergleichen mit</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={compare}
            onValueChange={(value) => navigate({ compare: value as CompareMode })}
          >
            {COMPARE_MODES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {COMPARE_MODE_LABELS[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <p className="text-sm text-muted-foreground">
        <span className="text-foreground">{formatRange(range)}</span>
        {compareRange && <span> · verglichen mit {formatRange(compareRange)}</span>}
      </p>
    </div>
  );
}
