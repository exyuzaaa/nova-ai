import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, Section } from "@/components/app/page-section";
import { progress, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listMilestones, listTasks } from "@/modules/projects/server/projects";
import { MilestoneActions, MilestoneForm } from "@/modules/projects/ui/project-forms";

export const metadata: Metadata = { title: "Meilensteine" };

const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

async function Milestones({ params }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/meilensteine">, "params">) {
  const { tenant: slug, projectId } = await params;
  const { tenant, project, myMemberId } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const [milestones, tasks] = await Promise.all([
    listMilestones(tenant.id, project.id),
    listTasks(tenant.id, project.id, { q: "", assignee: "all", done: true }, myMemberId),
  ]);
  const today = todayIn(tenant.timezone);

  return (
    <>
      {milestones.length === 0 ? (
        <EmptyState title="Noch keine Meilensteine">Meilensteine markieren wichtige Termine, z. B. „Entwurf freigegeben“ oder „Go-live“.</EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {milestones.map((milestone) => {
            const linked = tasks.filter((task) => task.milestoneId === milestone.id);
            const done = linked.filter((task) => task.completedAt).length;
            const overdue = !milestone.completedAt && milestone.dueDate !== null && milestone.dueDate < today;
            return (
              <li key={milestone.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label={`Meilenstein ${milestone.name}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 font-medium">
                      <span aria-hidden>◆</span>
                      {milestone.name}
                      {milestone.completedAt ? (
                        <Badge className="h-5 text-[11px]">Erreicht</Badge>
                      ) : overdue ? (
                        <Badge variant="outline" className="h-5 border-negative/40 text-[11px] text-negative">
                          Überfällig
                        </Badge>
                      ) : null}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {milestone.dueDate ? `Fällig am ${date.format(new Date(`${milestone.dueDate}T00:00:00Z`))}` : "Ohne Termin"} · {done} von {linked.length}{" "}
                      Aufgaben erledigt ({progress(done, linked.length)} %)
                    </p>
                    {milestone.description && <p className="mt-1 text-sm whitespace-pre-line">{milestone.description}</p>}
                  </div>
                  {project.canManage && (
                    <MilestoneActions tenantId={tenant.id} projectId={project.id} milestoneId={milestone.id} name={milestone.name} completed={Boolean(milestone.completedAt)} />
                  )}
                </div>
                {project.canManage && (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted-foreground">Bearbeiten</summary>
                    <div className="mt-2">
                      <MilestoneForm tenantId={tenant.id} projectId={project.id} values={milestone} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {project.canManage && !project.archivedAt && (
        <Section title="Neuer Meilenstein" description="Aufgaben ordnest du in der Aufgabe selbst einem Meilenstein zu.">
          <MilestoneForm tenantId={tenant.id} projectId={project.id} />
        </Section>
      )}
    </>
  );
}

export default function MilestonesPage({ params }: PageProps<"/app/[tenant]/projekte/[projectId]/meilensteine">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="Meilensteine werden geladen" />}>
      <Milestones params={params} />
    </Suspense>
  );
}
