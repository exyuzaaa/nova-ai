import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { addDays, parseView, shiftView, viewRange, type View } from "@/modules/calendar/domain/calendar";
import { getAgenda, getMyMemberId, listDueTasks } from "@/modules/calendar/server/calendar";
import { DayList, groupByDay, MonthGrid } from "@/modules/calendar/ui/views";

export const metadata: Metadata = { title: "Kalender" };

const VIEW_LABELS: Record<View, string> = { monat: "Monat", woche: "Woche", liste: "Nächste 30 Tage" };

async function CalendarView({ params, searchParams }: Pick<PageProps<"/app/[tenant]/kalender">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "calendar.view");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: tenant.timezone }).format(new Date());
  const { view, date } = parseView(query, today);
  const range = viewRange(view, date);
  const memberId = await getMyMemberId(tenant.id);
  const [occurrences, tasks] = await Promise.all([
    getAgenda(
      tenant.id,
      localDateTimeToUtc(`${range.from}T00:00`, tenant.timezone) ?? new Date().toISOString(),
      localDateTimeToUtc(`${range.to}T00:00`, tenant.timezone) ?? new Date().toISOString(),
    ),
    permissions.has("projects.view") ? listDueTasks(tenant.id, memberId, range.from, range.to) : Promise.resolve([]),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/kalender`;
  const days = groupByDay(occurrences, tasks, tenant.timezone, base);
  const link = (target: Partial<{ view: View; date: string }>) => `${base}?ansicht=${target.view ?? view}&datum=${target.date ?? date}`;
  const canEdit = permissions.has("calendar.edit");
  const title =
    view === "monat"
      ? new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`))
      : `${new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${range.from}T00:00:00Z`))} – ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${addDays(range.to, -1)}T00:00:00Z`))}`;
  const dates: string[] = [];
  for (let day = range.from; day < range.to; day = addDays(day, 1)) dates.push(day);

  return (
    <>
      <PageHeader
        title="Kalender"
        description={title}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/abo`}>
                <Rss className="size-4" aria-hidden />
                Abonnieren
              </Link>
            </Button>
            {canEdit && (
              <Button asChild size="sm">
                <Link href={`${base}/neu?datum=${date}`}>
                  <Plus className="size-4" aria-hidden />
                  Neuer Termin
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Zeitraum wählen" className="flex flex-wrap gap-2 text-sm">
          <Link href={link({ date: shiftView(view, date, -1) })} className="rounded-md border px-3 py-1 hover:bg-muted/40" aria-label="Zurück">
            ←
          </Link>
          <Link href={link({ date: today })} className="rounded-md border px-3 py-1 hover:bg-muted/40">
            Heute
          </Link>
          <Link href={link({ date: shiftView(view, date, 1) })} className="rounded-md border px-3 py-1 hover:bg-muted/40" aria-label="Weiter">
            →
          </Link>
        </nav>
        <nav aria-label="Ansicht" className="flex gap-1 rounded-lg border p-0.5 text-sm">
          {(Object.keys(VIEW_LABELS) as View[]).map((entry) => (
            <Link
              key={entry}
              href={link({ view: entry })}
              aria-current={entry === view ? "page" : undefined}
              className={cn("rounded-md px-3 py-1", entry === view ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {VIEW_LABELS[entry]}
            </Link>
          ))}
        </nav>
      </div>
      {view === "monat" && (
        <MonthGrid from={range.from} to={range.to} month={date.slice(0, 7)} today={today} days={days} newHref={canEdit ? (day) => `${base}/neu?datum=${day}` : null} />
      )}
      {view === "woche" && <DayList dates={dates} today={today} days={days} emptyText="Keine Termine" />}
      {view === "liste" &&
        (days.size === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Keine Termine in den nächsten 30 Tagen.</p>
        ) : (
          <DayList dates={dates} today={today} days={days} />
        ))}
      <p className="text-xs text-muted-foreground">
        Farbiger Punkt: Kalender · Ring: Einladung noch offen · durchgestrichen: abgesagt
        {permissions.has("projects.view") && " · kursiv: deine fälligen Projektaufgaben"}
      </p>
    </>
  );
}

export default function CalendarPage({ params, searchParams }: PageProps<"/app/[tenant]/kalender">) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" role="status" aria-label="Kalender wird geladen" />}>
      <CalendarView params={params} searchParams={searchParams} />
    </Suspense>
  );
}
