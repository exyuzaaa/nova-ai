import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { formatMinutes, monthRange, parseMonth, shiftMonth, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listTaskOptions } from "@/modules/projects/server/projects";
import { getRunningTimer, listTimeEntries, sumBy } from "@/modules/projects/server/time";
import { TimeEntryForm, TimerCard } from "@/modules/projects/ui/time-forms";
import { TimeEntryList } from "@/modules/projects/ui/time-list";

export const metadata: Metadata = { title: "Zeiten" };

const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });

async function ProjectTimes({ params, searchParams }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/zeiten">, "params" | "searchParams">) {
  const [{ tenant: slug, projectId }, query] = await Promise.all([params, searchParams]);
  const { tenant, project, permissions, memberNames, myMemberId, user } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const canTrack = permissions.has("projects.time") && !project.archivedAt && !project.isTemplate;
  const canSeeAll = permissions.has("projects.time_all");
  const today = todayIn(tenant.timezone);
  const month = parseMonth(query.monat, today);
  const range = monthRange(month);
  const [entries, allEntries, running, tasks] = await Promise.all([
    listTimeEntries(tenant.id, {
      projectId: project.id,
      from: localDateTimeToUtc(`${range.from}T00:00`, tenant.timezone) ?? undefined,
      to: localDateTimeToUtc(`${range.to}T00:00`, tenant.timezone) ?? undefined,
    }),
    listTimeEntries(tenant.id, { projectId: project.id, limit: 5000 }),
    getRunningTimer(tenant.id, myMemberId),
    listTaskOptions(tenant.id, project.id),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/projekte`;
  const monthTotal = entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
  const monthBillable = entries.reduce((sum, entry) => sum + (entry.billable ? (entry.minutes ?? 0) : 0), 0);
  const allTotal = allEntries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
  const budgetMinutes = project.budgetHours === null ? null : project.budgetHours * 60;
  const byPerson = [...sumBy(entries, (entry) => entry.memberId)].sort((a, b) => b[1] - a[1]);
  const byTask = [...sumBy(entries, (entry) => (entry.taskId ? `#${entry.taskNumber} ${entry.taskTitle}` : "Ohne Aufgabe"))].sort((a, b) => b[1] - a[1]);
  const percent = budgetMinutes ? Math.round((allTotal / budgetMinutes) * 100) : null;

  return (
    <>
      {!canSeeAll && <p className="text-sm text-muted-foreground">Du siehst hier deine eigenen Zeiten in diesem Projekt.</p>}
      {canTrack && (
        <TimerCard
          tenantId={tenant.id}
          projectId={project.id}
          startLabel="Stoppuhr für dieses Projekt"
          running={running ? { projectName: running.projectName, taskTitle: running.taskTitle, startedAt: running.startedAt, note: running.note } : null}
        />
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{monthFormat.format(new Date(`${range.from}T00:00:00Z`))}</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatMinutes(monthTotal)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">davon abrechenbar</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatMinutes(monthBillable)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">{canSeeAll ? "Gesamt im Projekt" : "Deine Zeit gesamt"}</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatMinutes(allTotal)}</dd>
        </div>
        {budgetMinutes !== null && canSeeAll && (
          <div className="rounded-xl border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Budget ({String(project.budgetHours).replace(".", ",")} h)</dt>
            <dd className={`text-xl font-semibold tabular-nums ${percent !== null && percent > 100 ? "text-negative" : ""}`}>{percent} % verbraucht</dd>
          </div>
        )}
      </dl>
      <nav aria-label="Monat wählen" className="flex flex-wrap gap-2 text-sm">
        <Link href={`?monat=${shiftMonth(month, -1)}`} className="rounded-md border px-3 py-1 hover:bg-muted/40">
          ← {monthFormat.format(new Date(`${shiftMonth(month, -1)}-01T00:00:00Z`))}
        </Link>
        <Link href={`?monat=${shiftMonth(month, 1)}`} className="rounded-md border px-3 py-1 hover:bg-muted/40">
          {monthFormat.format(new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`))} →
        </Link>
      </nav>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Einträge">
          {entries.length === 0 ? (
            <EmptyState title="Keine Zeiten in diesem Monat" />
          ) : (
            <TimeEntryList
              tenantId={tenant.id}
              entries={entries}
              timeZone={tenant.timezone}
              today={today}
              base={base}
              showProject={false}
              memberNames={canSeeAll ? memberNames : undefined}
              tasksByProject={new Map([[project.id, tasks]])}
              canChange={(entry) => !project.archivedAt && (canSeeAll || entry.userId === user.id)}
            />
          )}
        </Section>
        <div className="flex flex-col gap-4">
          {canTrack && (
            <Section title="Zeit nachtragen">
              <TimeEntryForm tenantId={tenant.id} today={today} projectId={project.id} tasks={tasks} />
            </Section>
          )}
          {entries.length > 0 && (
            <Section title="Auswertung des Monats">
              {canSeeAll && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">Nach Person</h3>
                  <ul className="flex flex-col text-sm">
                    {byPerson.map(([memberId, minutes]) => (
                      <li key={memberId ?? "none"} className="flex justify-between gap-2 py-0.5">
                        <span className="truncate">{(memberId && memberNames.get(memberId)) || "Ehemaliges Mitglied"}</span>
                        <span className="tabular-nums">{formatMinutes(minutes)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Nach Aufgabe</h3>
                <ul className="flex flex-col text-sm">
                  {byTask.map(([label, minutes]) => (
                    <li key={label} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{label}</span>
                      <span className="tabular-nums">{formatMinutes(minutes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

export default function ProjectTimesPage({ params, searchParams }: PageProps<"/app/[tenant]/projekte/[projectId]/zeiten">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Zeiten werden geladen" />}>
      <ProjectTimes params={params} searchParams={searchParams} />
    </Suspense>
  );
}
