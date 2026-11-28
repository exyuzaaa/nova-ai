import Link from "next/link";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { utcToLocalDateTime } from "@/modules/core/domain/time-zone";
import { addDays } from "../domain/calendar";
import type { Occurrence } from "../server/calendar";

export type DayItem = {
  key: string;
  title: string;
  href: string;
  color: string;
  time: string | null;
  allDay: boolean;
  recurring: boolean;
  declined: boolean;
  pending: boolean;
  sort: string;
  kind: "event" | "task";
  subtitle?: string;
};

/** Vorkommen und fällige Aufgaben nach lokalem Tag gruppieren (mehrtägige Termine an jedem Tag). */
export const groupByDay = (
  occurrences: Occurrence[],
  tasks: { id: string; projectId: string; number: number; title: string; dueDate: string; projectName: string; color: string }[],
  timeZone: string,
  base: string,
): Map<string, DayItem[]> => {
  const days = new Map<string, DayItem[]>();
  const push = (day: string, item: DayItem) => days.set(day, [...(days.get(day) ?? []), item]);
  for (const occurrence of occurrences) {
    const start = utcToLocalDateTime(occurrence.start, timeZone);
    const end = utcToLocalDateTime(new Date(Date.parse(occurrence.end) - 60000).toISOString(), timeZone);
    let day = start.slice(0, 10);
    const last = end.slice(0, 10);
    for (let guard = 0; day <= last && guard < 32; guard += 1, day = addDays(day, 1)) {
      push(day, {
        key: `${occurrence.eventId}-${occurrence.start}-${day}`,
        title: occurrence.title,
        href: `${base}/termine/${occurrence.eventId}?am=${encodeURIComponent(occurrence.start)}`,
        color: occurrence.color,
        time: occurrence.allDay ? null : day === start.slice(0, 10) ? start.slice(11) : "…",
        allDay: occurrence.allDay,
        recurring: occurrence.isRecurring,
        declined: occurrence.myResponse === "declined",
        pending: occurrence.myResponse === "pending",
        sort: occurrence.allDay ? "00" : day === start.slice(0, 10) ? start.slice(11) : "00:00",
        kind: "event",
        subtitle: occurrence.location ?? undefined,
      });
    }
  }
  for (const task of tasks) {
    push(task.dueDate, {
      key: `task-${task.id}`,
      title: `Fällig: ${task.title}`,
      href: `${base.replace(/\/kalender$/, "/projekte")}/${task.projectId}/aufgaben/${task.id}`,
      color: task.color,
      time: null,
      allDay: true,
      recurring: false,
      declined: false,
      pending: false,
      sort: "01",
      kind: "task",
      subtitle: task.projectName,
    });
  }
  for (const items of days.values()) items.sort((a, b) => a.sort.localeCompare(b.sort) || a.title.localeCompare(b.title, "de"));
  return days;
};

const weekdayShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function ItemLink({ item, compact = false }: { item: DayItem; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted/60",
        item.declined && "text-muted-foreground line-through",
        item.kind === "task" && "italic",
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", item.pending && "ring-1 ring-offset-1 ring-current")} style={{ backgroundColor: item.color }} aria-hidden />
      {item.time && <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{item.time}</span>}
      <span className={cn("truncate", compact && "sr-only sm:not-sr-only sm:truncate")}>{item.title}</span>
      {item.recurring && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Serie" />}
      {item.pending && <span className="sr-only">(Einladung offen)</span>}
    </Link>
  );
}

export function MonthGrid({
  from,
  to,
  month,
  today,
  days,
  newHref,
}: {
  from: string;
  to: string;
  month: string;
  today: string;
  days: Map<string, DayItem[]>;
  newHref: ((date: string) => string) | null;
}) {
  const dates: string[] = [];
  for (let day = from; day < to; day = addDays(day, 1)) dates.push(day);
  const label = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <div className="overflow-hidden rounded-xl border" role="grid" aria-label="Monatsansicht">
      <div role="row" className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium text-muted-foreground">
        {weekdayShort.map((day) => (
          <span key={day} role="columnheader" className="py-1.5">
            {day}
          </span>
        ))}
      </div>
      {Array.from({ length: dates.length / 7 }, (_, week) => (
        <div key={week} role="row" className="grid grid-cols-7 border-b last:border-b-0">
          {dates.slice(week * 7, week * 7 + 7).map((date) => {
            const items = days.get(date) ?? [];
            const outside = !date.startsWith(month);
            return (
              <div
                key={date}
                role="gridcell"
                aria-label={`${label.format(new Date(`${date}T00:00:00Z`))}${items.length ? `, ${items.length} Einträge` : ""}`}
                className={cn("flex min-h-20 min-w-0 flex-col gap-0.5 border-r p-1 last:border-r-0 sm:min-h-28", outside && "bg-muted/20")}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      date === today && "bg-brand font-semibold text-white",
                      outside && date !== today && "text-muted-foreground",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {newHref && (
                    <Link href={newHref(date)} className="hidden rounded px-1 text-xs text-muted-foreground hover:bg-muted sm:inline" aria-label={`Neuer Termin am ${label.format(new Date(`${date}T00:00:00Z`))}`}>
                      +
                    </Link>
                  )}
                </span>
                {items.slice(0, 4).map((item) => (
                  <ItemLink key={item.key} item={item} compact />
                ))}
                {items.length > 4 && <span className="px-1 text-[11px] text-muted-foreground">+{items.length - 4} weitere</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DayList({ dates, today, days, emptyText }: { dates: string[]; today: string; days: Map<string, DayItem[]>; emptyText?: string }) {
  const label = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shown = emptyText ? dates : dates.filter((date) => (days.get(date) ?? []).length > 0);
  return (
    <ol className="flex flex-col gap-3">
      {shown.map((date) => {
        const items = days.get(date) ?? [];
        return (
          <li key={date} className="rounded-xl border bg-card p-3" aria-label={label.format(new Date(`${date}T00:00:00Z`))}>
            <h2 className={cn("mb-1 text-sm font-medium", date === today && "text-brand")}>
              {label.format(new Date(`${date}T00:00:00Z`))}
              {date === today && " · heute"}
            </h2>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">{emptyText}</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.key} className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
                    <ItemLink item={item} />
                    {item.subtitle && <span className="truncate pl-5 text-xs text-muted-foreground sm:pl-0">{item.subtitle}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
