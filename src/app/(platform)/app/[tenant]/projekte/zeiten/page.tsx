import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { Button } from "@/components/ui/button";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { addDays, formatMinutes, todayIn, weekStart } from "@/modules/projects/domain/projects";
import { getMyMemberId } from "@/modules/projects/server/projects";
import { getRunningTimer, listTimeEntries, listTimeProjectOptions } from "@/modules/projects/server/time";
import { TimeEntryForm, TimerCard } from "@/modules/projects/ui/time-forms";
import { TimeEntryList } from "@/modules/projects/ui/time-list";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";

export const metadata: Metadata = { title: "Zeiten" };

const dayFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" });

async function MyTimes({ params, searchParams }: Pick<PageProps<"/app/[tenant]/projekte/zeiten">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant, permissions, user } = await requireTenantContext(decodeURIComponent(slug), "projects.time");
  const today = todayIn(tenant.timezone);
  const week = weekStart(typeof query.woche === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.woche) ? query.woche : today);
  const canSeeAll = permissions.has("projects.time_all");
  const myMemberId = await getMyMemberId(tenant.id);
  const person = canSeeAll && typeof query.person === "string" && uuidSchema.safeParse(query.person).success ? query.person : myMemberId;
  const [entries, running, projects, members] = await Promise.all([
    listTimeEntries(tenant.id, {
      memberId: person ?? undefined,
      from: localDateTimeToUtc(`${week}T00:00`, tenant.timezone) ?? undefined,
      to: localDateTimeToUtc(`${addDays(week, 7)}T00:00`, tenant.timezone) ?? undefined,
    }),
    getRunningTimer(tenant.id, myMemberId),
    listTimeProjectOptions(tenant.id),
    canSeeAll ? listMembers(tenant.id) : Promise.resolve([]),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/projekte`;
  const total = entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
  const billable = entries.reduce((sum, entry) => sum + (entry.billable ? (entry.minutes ?? 0) : 0), 0);
  const link = (target: string) => `${base}/zeiten?woche=${target}${person && person !== myMemberId ? `&person=${person}` : ""}`;
  const own = person === myMemberId;

  return (
    <>
      <PageHeader
        title={own ? "Meine Zeiten" : "Zeiten"}
        description={`Woche vom ${dayFormat.format(new Date(`${week}T00:00:00Z`))} bis ${dayFormat.format(new Date(`${addDays(week, 6)}T00:00:00Z`))}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={base}>Zu den Projekten</Link>
          </Button>
        }
      />
      <TimerCard
        tenantId={tenant.id}
        projects={projects}
        running={running ? { projectName: running.projectName, taskTitle: running.taskTitle, startedAt: running.startedAt, note: running.note } : null}
      />
      <nav aria-label="Woche wählen" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={link(addDays(week, -7))} className="rounded-md border px-3 py-1 hover:bg-muted/40">
          ← Vorherige Woche
        </Link>
        {week !== weekStart(today) && (
          <Link href={link(weekStart(today))} className="rounded-md border px-3 py-1 hover:bg-muted/40">
            Diese Woche
          </Link>
        )}
        <Link href={link(addDays(week, 7))} className="rounded-md border px-3 py-1 hover:bg-muted/40">
          Nächste Woche →
        </Link>
        {canSeeAll && (
          <form className="ml-auto flex items-end gap-2">
            <input type="hidden" name="woche" value={week} />
            <NativeSelect label="Person" hideLabel name="person" defaultValue={person ?? ""}>
              {members.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.memberId === myMemberId ? `Ich (${member.email})` : member.email}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" size="sm" variant="outline">
              Anzeigen
            </Button>
          </form>
        )}
      </nav>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Summe der Woche</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatMinutes(total)}</dd>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <dt className="text-xs text-muted-foreground">davon abrechenbar</dt>
          <dd className="text-xl font-semibold tabular-nums">{formatMinutes(billable)}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Einträge">
          {entries.length === 0 ? (
            <EmptyState title="Keine Zeiten in dieser Woche" />
          ) : (
            <TimeEntryList
              tenantId={tenant.id}
              entries={entries}
              timeZone={tenant.timezone}
              today={today}
              base={base}
              showProject
              canChange={(entry) => canSeeAll || entry.userId === user.id}
            />
          )}
        </Section>
        {own && (
          <Section title="Zeit nachtragen">
            <TimeEntryForm tenantId={tenant.id} today={today} projects={projects} />
          </Section>
        )}
      </div>
    </>
  );
}

export default function TimesPage({ params, searchParams }: PageProps<"/app/[tenant]/projekte/zeiten">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Zeiten werden geladen" />}>
      <MyTimes params={params} searchParams={searchParams} />
    </Suspense>
  );
}
