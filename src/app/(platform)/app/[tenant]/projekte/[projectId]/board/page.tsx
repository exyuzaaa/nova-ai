import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { dueState, PRIORITY_LABELS, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listStatuses, listTasks } from "@/modules/projects/server/projects";
import { MoveTaskForm, QuickTaskForm } from "@/modules/projects/ui/task-forms";

export const metadata: Metadata = { title: "Board" };

const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

async function Board({ params }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/board">, "params">) {
  const { tenant: slug, projectId } = await params;
  const { tenant, project, memberNames, myMemberId } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const [statuses, tasks] = await Promise.all([
    listStatuses(tenant.id, project.id),
    listTasks(tenant.id, project.id, { q: "", assignee: "all", done: true }, myMemberId),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/projekte/${project.id}`;
  const today = todayIn(tenant.timezone);
  const statusOptions = statuses.map((status) => ({ id: status.id, label: status.name }));

  return (
    <>
      <h2 className="sr-only">Board</h2>
      {/* relative: hält absolut positionierte Screenreader-Texte im Scroll-Container */}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-3" aria-label="Status">
          {statuses.map((status) => {
            const cards = tasks.filter((task) => task.statusId === status.id);
            return (
              <li key={status.id} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/20 p-3" aria-label={`Status ${status.name}`}>
                <h3 className="flex items-center justify-between text-sm font-medium">
                  <span>{status.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{cards.length}</span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {cards.length === 0 && <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Keine Aufgaben</li>}
                  {cards.map((task) => {
                    const due = dueState(task.dueDate, today, Boolean(task.completedAt));
                    return (
                      <li key={task.id} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
                        <Link href={`${base}/aufgaben/${task.id}`} className="text-sm font-medium hover:underline">
                          {task.title}
                        </Link>
                        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          <span className="font-mono">#{task.number}</span>
                          {task.priority !== "normal" && (
                            <span className={cn(task.priority === "urgent" && "font-medium text-negative")}>{PRIORITY_LABELS[task.priority]}</span>
                          )}
                          {task.dueDate && (
                            <span className={cn(due === "overdue" && "font-medium text-negative")}>bis {date.format(new Date(`${task.dueDate}T00:00:00Z`))}</span>
                          )}
                          {task.subtasks.total > 0 && (
                            <span>
                              {task.subtasks.done}/{task.subtasks.total} Unteraufgaben
                            </span>
                          )}
                        </p>
                        {task.assigneeMemberId && <p className="truncate text-xs text-muted-foreground">{memberNames.get(task.assigneeMemberId)}</p>}
                        {project.canEdit && (
                          <MoveTaskForm tenantId={tenant.id} projectId={project.id} taskId={task.id} title={task.title} statusId={status.id} statuses={statusOptions} />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {project.canEdit && status.category !== "done" && (
                  <QuickTaskForm tenantId={tenant.id} projectId={project.id} statusId={status.id} label={`Neue Aufgabe in ${status.name}`} placeholder="Titel" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}

export default function BoardPage({ params }: PageProps<"/app/[tenant]/projekte/[projectId]/board">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Board wird geladen" />}>
      <Board params={params} />
    </Suspense>
  );
}
