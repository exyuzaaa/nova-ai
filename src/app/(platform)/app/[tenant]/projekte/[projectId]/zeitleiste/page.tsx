import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { addDays, timelineBar, timelineRange, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listMilestones, listTasks } from "@/modules/projects/server/projects";

export const metadata: Metadata = { title: "Zeitleiste" };

const short = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });
const fmt = (iso: string, format = short) => format.format(new Date(`${iso}T00:00:00Z`));

async function Timeline({ params }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/zeitleiste">, "params">) {
  const { tenant: slug, projectId } = await params;
  const { tenant, project, myMemberId } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const [tasks, milestones] = await Promise.all([
    listTasks(tenant.id, project.id, { q: "", assignee: "all", done: true }, myMemberId),
    listMilestones(tenant.id, project.id),
  ]);
  const today = todayIn(tenant.timezone);
  const base = `${tenantBasePath(tenant.slug)}/projekte/${project.id}`;
  const planned = tasks.filter((task) => !task.parentId && (task.startDate || task.dueDate));
  const items = [
    ...planned.map((task) => ({ id: task.id, start: task.startDate, end: task.dueDate })),
    ...milestones.map((milestone) => ({ id: milestone.id, start: milestone.dueDate, end: milestone.dueDate })),
    { id: "project", start: project.startDate, end: project.dueDate },
  ];
  const { from, weeks } = timelineRange(items, today);
  const todayBar = timelineBar({ id: "today", start: today, end: today }, from, weeks);
  const unplanned = tasks.filter((task) => !task.parentId && !task.startDate && !task.dueDate).length;

  if (planned.length === 0 && milestones.every((milestone) => !milestone.dueDate)) {
    return (
      <EmptyState title="Noch nichts geplant">
        Gib Aufgaben ein Start- oder Fälligkeitsdatum oder lege Meilensteine mit Termin an – dann erscheinen sie hier.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {fmt(from, long)} bis {fmt(addDays(from, weeks * 7 - 1), long)}
        {unplanned > 0 && ` · ${unplanned} Aufgaben ohne Termin sind nicht dargestellt`}
      </p>
      {/* relative: hält absolut positionierte Inhalte im Scroll-Container */}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="min-w-[720px]" role="table" aria-label="Zeitleiste">
          <div role="row" className="grid grid-cols-[12rem_1fr] border-b text-xs text-muted-foreground">
            <span role="columnheader" className="py-1">
              Aufgabe
            </span>
            <span role="columnheader" className="relative flex">
              {Array.from({ length: weeks }, (_, index) => (
                <span key={index} className="flex-1 border-l py-1 pl-1">
                  {fmt(addDays(from, index * 7))}
                </span>
              ))}
            </span>
          </div>
          {milestones
            .filter((milestone) => milestone.dueDate)
            .map((milestone) => {
              const bar = timelineBar({ id: milestone.id, start: milestone.dueDate, end: milestone.dueDate }, from, weeks);
              return (
                <div key={milestone.id} role="row" className="grid grid-cols-[12rem_1fr] border-b">
                  <span role="cell" className="truncate py-1.5 pr-2 text-sm font-medium">
                    ◆ {milestone.name}
                  </span>
                  <span role="cell" className="relative">
                    {bar && (
                      <span
                        className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45", milestone.completedAt ? "bg-positive" : "bg-foreground")}
                        style={{ left: `${bar.left + bar.width / 2}%` }}
                      />
                    )}
                    <span className="sr-only">Meilenstein am {fmt(milestone.dueDate as string, long)}</span>
                  </span>
                </div>
              );
            })}
          {planned.map((task) => {
            const bar = timelineBar({ id: task.id, start: task.startDate, end: task.dueDate }, from, weeks);
            const overdue = !task.completedAt && task.dueDate !== null && task.dueDate < today;
            return (
              <div key={task.id} role="row" className="grid grid-cols-[12rem_1fr] border-b">
                <span role="cell" className="truncate py-1.5 pr-2 text-sm">
                  <Link href={`${base}/aufgaben/${task.id}`} className={cn("hover:underline", task.completedAt && "text-muted-foreground line-through")}>
                    #{task.number} {task.title}
                  </Link>
                </span>
                <span role="cell" className="relative">
                  {todayBar && <span className="absolute inset-y-0 w-px bg-negative/50" style={{ left: `${todayBar.left}%` }} aria-hidden />}
                  {bar && (
                    <span
                      className={cn("absolute top-1/2 h-4 -translate-y-1/2 rounded", overdue && "ring-2 ring-negative")}
                      style={{ left: `${bar.left}%`, width: `${bar.width}%`, backgroundColor: project.color, opacity: task.completedAt ? 0.4 : 1 }}
                    />
                  )}
                  <span className="sr-only">
                    {task.startDate ? `Start ${fmt(task.startDate, long)}` : ""} {task.dueDate ? `fällig ${fmt(task.dueDate, long)}` : ""}
                    {overdue ? ", überfällig" : ""}
                    {task.completedAt ? ", erledigt" : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Rote Linie: heute · rot umrandet: überfällig · blass: erledigt · ◆ Meilenstein</p>
    </>
  );
}

export default function TimelinePage({ params }: PageProps<"/app/[tenant]/projekte/[projectId]/zeitleiste">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Zeitleiste wird geladen" />}>
      <Timeline params={params} />
    </Suspense>
  );
}
