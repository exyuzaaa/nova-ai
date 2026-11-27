import Link from "next/link";
import { utcToLocalDateTime } from "@/modules/core/domain/time-zone";
import { formatMinutes } from "../domain/projects";
import type { TimeEntry } from "../server/time";
import { DeleteTimeEntryButton, TimeEntryForm } from "./time-forms";

/** Liste von Zeiteinträgen, nach Tagen gruppiert, mit Bearbeiten/Löschen für erlaubte Einträge. */
export function TimeEntryList({
  tenantId,
  entries,
  timeZone,
  today,
  base,
  canChange,
  memberNames,
  showProject,
  tasksByProject,
}: {
  tenantId: string;
  entries: TimeEntry[];
  timeZone: string;
  today: string;
  base: string;
  canChange: (entry: TimeEntry) => boolean;
  memberNames?: Map<string, string>;
  showProject: boolean;
  tasksByProject?: Map<string, { id: string; label: string }[]>;
}) {
  const dayFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const groups = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const day = utcToLocalDateTime(entry.startedAt, timeZone).slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([day, rows]) => {
        const total = rows.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
        return (
          <section key={day} aria-label={dayFormat.format(new Date(`${day}T00:00:00Z`))} className="flex flex-col gap-1">
            <h3 className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>{dayFormat.format(new Date(`${day}T00:00:00Z`))}</span>
              <span className="tabular-nums">{formatMinutes(total)}</span>
            </h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {rows.map((entry) => {
                const start = utcToLocalDateTime(entry.startedAt, timeZone);
                const end = entry.endedAt ? utcToLocalDateTime(entry.endedAt, timeZone) : null;
                const label = `${start.slice(11)}–${end ? end.slice(11) : "läuft"}`;
                return (
                  <li key={entry.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{entry.minutes === null ? "läuft" : formatMinutes(entry.minutes)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {showProject && (
                          <Link href={`${base}/${entry.projectId}/zeiten`} className="hover:underline">
                            <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: entry.projectColor }} aria-hidden />
                            {entry.projectName}
                          </Link>
                        )}
                        {entry.taskId && (
                          <>
                            {showProject && " · "}
                            <Link href={`${base}/${entry.projectId}/aufgaben/${entry.taskId}`} className="hover:underline">
                              #{entry.taskNumber} {entry.taskTitle}
                            </Link>
                          </>
                        )}
                        {entry.note && <span className="text-muted-foreground"> – {entry.note}</span>}
                      </span>
                      {!entry.billable && <span className="text-xs text-muted-foreground">nicht abrechenbar</span>}
                      {memberNames && entry.memberId && <span className="text-xs text-muted-foreground">{memberNames.get(entry.memberId)}</span>}
                      {canChange(entry) && entry.endedAt && <DeleteTimeEntryButton tenantId={tenantId} entryId={entry.id} label={label} />}
                    </div>
                    {canChange(entry) && entry.endedAt && (
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">Bearbeiten</summary>
                        <div className="mt-2">
                          <TimeEntryForm
                            tenantId={tenantId}
                            today={today}
                            tasks={tasksByProject?.get(entry.projectId)}
                            values={{
                              id: entry.id,
                              projectId: entry.projectId,
                              taskId: entry.taskId,
                              date: start.slice(0, 10),
                              start: start.slice(11),
                              end: end?.slice(0, 10) === start.slice(0, 10) ? end.slice(11) : "",
                              note: entry.note,
                              billable: entry.billable,
                            }}
                          />
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
