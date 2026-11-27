import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Section } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { Button } from "@/components/ui/button";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { parseTaskListQuery, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listMilestones, listStatuses, listTasks } from "@/modules/projects/server/projects";
import { QuickTaskForm } from "@/modules/projects/ui/task-forms";
import { TaskLine } from "@/modules/projects/ui/task-line";

export const metadata: Metadata = { title: "Aufgaben" };

async function TaskList({ params, searchParams }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]">, "params" | "searchParams">) {
  const [{ tenant: slug, projectId }, rawQuery] = await Promise.all([params, searchParams]);
  const { tenant, project, memberNames, myMemberId } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const query = parseTaskListQuery(rawQuery);
  const [statuses, tasks, milestones] = await Promise.all([
    listStatuses(tenant.id, project.id),
    listTasks(tenant.id, project.id, query, myMemberId),
    listMilestones(tenant.id, project.id),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/projekte/${project.id}`;
  const today = todayIn(tenant.timezone);
  const firstDone = statuses.find((status) => status.category === "done");
  const firstTodo = statuses.find((status) => status.category === "todo");
  const milestoneNames = new Map(milestones.map((milestone) => [milestone.id, milestone.name]));
  const filtered = Boolean(query.q) || query.assignee !== "all";

  return (
    <>
      {project.canEdit && <QuickTaskForm tenantId={tenant.id} projectId={project.id} />}

      <form className="flex flex-wrap items-end gap-2" role="search" aria-label="Aufgaben filtern">
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <label htmlFor="task-search" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="task-search"
            name="q"
            defaultValue={query.q}
            placeholder="Titel"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <NativeSelect label="Zuständig" name="zustaendig" defaultValue={query.assignee}>
          <option value="all">Alle</option>
          <option value="me">Ich</option>
          <option value="none">Niemand</option>
          {[...memberNames].map(([id, email]) => (
            <option key={id} value={id}>
              {email}
            </option>
          ))}
        </NativeSelect>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="erledigt" value="1" defaultChecked={query.done} />
          Erledigte zeigen
        </label>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState title={filtered ? "Keine passenden Aufgaben" : "Keine offenen Aufgaben"}>
          {!filtered && project.canEdit && "Lege oben die erste Aufgabe an."}
        </EmptyState>
      ) : (
        statuses
          .filter((status) => query.done || status.category !== "done")
          .map((status) => {
            const rows = tasks.filter((task) => task.statusId === status.id);
            if (rows.length === 0) return null;
            return (
              <Section key={status.id} title={`${status.name} (${rows.length})`}>
                <ul className="flex flex-col divide-y">
                  {rows.map((task) => (
                    <TaskLine
                      key={task.id}
                      tenantId={tenant.id}
                      projectId={project.id}
                      href={`${base}/aufgaben/${task.id}`}
                      task={task}
                      today={today}
                      assignee={task.assigneeMemberId ? memberNames.get(task.assigneeMemberId) : undefined}
                      milestone={task.milestoneId ? milestoneNames.get(task.milestoneId) : undefined}
                      canEdit={project.canEdit}
                      toggleStatusId={task.completedAt ? firstTodo?.id : firstDone?.id}
                    />
                  ))}
                </ul>
              </Section>
            );
          })
      )}
      <p className="text-xs text-muted-foreground">
        Zum Verschieben zwischen Status eignet sich das{" "}
        <Link href={`${base}/board`} className="font-medium text-brand hover:underline">
          Board
        </Link>
        .
      </p>
    </>
  );
}

export default function ProjectTasksPage({ params, searchParams }: PageProps<"/app/[tenant]/projekte/[projectId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Aufgaben werden geladen" />}>
      <TaskList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
