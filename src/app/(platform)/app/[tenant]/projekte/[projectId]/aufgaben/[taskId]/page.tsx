import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { dueState, formatMinutes, PRIORITY_LABELS, todayIn } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { getTask, listMilestones, listStatuses, listTaskOptions } from "@/modules/projects/server/projects";
import {
  Checklist,
  CommentForm,
  CommentItem,
  DeleteTaskButton,
  DependencyForm,
  QuickTaskForm,
  RemoveDependencyButton,
  TaskForm,
} from "@/modules/projects/ui/task-forms";
import { TaskLine } from "@/modules/projects/ui/task-line";

export const metadata: Metadata = { title: "Aufgabe" };

const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

async function TaskDetail({ params }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/aufgaben/[taskId]">, "params">) {
  const { tenant: slug, projectId, taskId } = await params;
  const { tenant, project, members, memberNames, user } = await loadProjectContext(decodeURIComponent(slug), projectId);
  if (!uuidSchema.safeParse(taskId).success) notFound();
  const task = await getTask(tenant.id, project.id, taskId);
  if (!task) notFound();

  const [statuses, milestones, taskOptions] = await Promise.all([
    listStatuses(tenant.id, project.id),
    listMilestones(tenant.id, project.id),
    project.canEdit ? listTaskOptions(tenant.id, project.id) : Promise.resolve([]),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/projekte/${project.id}`;
  const today = todayIn(tenant.timezone);
  const status = statuses.find((entry) => entry.id === task.statusId);
  const firstDone = statuses.find((entry) => entry.category === "done");
  const firstTodo = statuses.find((entry) => entry.category === "todo");
  const due = dueState(task.dueDate, today, Boolean(task.completedAt));
  const canEdit = project.canEdit;
  const linked = new Set([task.id, ...task.dependsOn.map((entry) => entry.id)]);
  const userNames = new Map(members.map((member) => [member.userId, member.email]));
  const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tenant.timezone });
  const parent = task.parentId ? taskOptions.find((option) => option.id === task.parentId) : undefined;
  const openBlockers = task.dependsOn.filter((entry) => !entry.done);

  return (
    <>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {task.parentId && (
            <p className="text-xs text-muted-foreground">
              Unteraufgabe von{" "}
              <Link href={`${base}/aufgaben/${task.parentId}`} className="hover:underline">
                {parent?.label ?? "übergeordneter Aufgabe"}
              </Link>
            </p>
          )}
          <h2 className="text-lg font-semibold tracking-tight">
            <span className="font-mono text-sm font-normal text-muted-foreground">#{task.number}</span> {task.title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {status && (
              <Badge variant={status.category === "done" ? "default" : "outline"} className="h-5 text-[11px]">
                {status.name}
              </Badge>
            )}
            <span>Priorität {PRIORITY_LABELS[task.priority]}</span>
            <span>· {task.assigneeMemberId ? `zuständig: ${memberNames.get(task.assigneeMemberId) ?? "–"}` : "niemand zuständig"}</span>
            {task.dueDate && (
              <span className={cn(due === "overdue" && "font-medium text-negative")}>
                · fällig {date.format(new Date(`${task.dueDate}T00:00:00Z`))}
                {due === "overdue" && " (überfällig)"}
              </span>
            )}
            {task.estimateMinutes !== null && <span>· geschätzt {formatMinutes(task.estimateMinutes)}</span>}
          </p>
          {openBlockers.length > 0 && (
            <p className="mt-1 text-sm text-negative" role="note">
              Wartet noch auf {openBlockers.length === 1 ? "eine Aufgabe" : `${openBlockers.length} Aufgaben`}.
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <DeleteTaskButton tenantId={tenant.id} projectId={project.id} taskId={task.id} title={task.title} />
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {task.description && !canEdit && (
            <Section title="Beschreibung">
              <p className="text-sm whitespace-pre-line">{task.description}</p>
            </Section>
          )}
          {!task.parentId && (
            <Section title={`Unteraufgaben (${task.subtaskRows.filter((row) => row.completedAt).length}/${task.subtaskRows.length})`}>
              {task.subtaskRows.length > 0 && (
                <ul className="flex flex-col divide-y">
                  {task.subtaskRows.map((row) => (
                    <TaskLine
                      key={row.id}
                      tenantId={tenant.id}
                      projectId={project.id}
                      href={`${base}/aufgaben/${row.id}`}
                      task={row}
                      today={today}
                      assignee={row.assigneeMemberId ? memberNames.get(row.assigneeMemberId) : undefined}
                      canEdit={canEdit}
                      toggleStatusId={row.completedAt ? firstTodo?.id : firstDone?.id}
                    />
                  ))}
                </ul>
              )}
              {canEdit && <QuickTaskForm tenantId={tenant.id} projectId={project.id} parentId={task.id} label="Neue Unteraufgabe" />}
            </Section>
          )}
          <Section title="Checkliste">
            <Checklist tenantId={tenant.id} projectId={project.id} taskId={task.id} items={task.checklist} canEdit={canEdit} />
          </Section>
          <Section title={`Kommentare (${task.comments.length})`}>
            {task.comments.length > 0 && (
              <ul className="flex flex-col divide-y">
                {task.comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    tenantId={tenant.id}
                    projectId={project.id}
                    taskId={task.id}
                    comment={comment}
                    author={(comment.authorId && userNames.get(comment.authorId)) || "Ehemaliges Mitglied"}
                    when={when.format(new Date(comment.createdAt))}
                    own={canEdit && comment.authorId === user.id}
                    canDelete={(canEdit && comment.authorId === user.id) || project.canManage}
                  />
                ))}
              </ul>
            )}
            {canEdit && <CommentForm tenantId={tenant.id} projectId={project.id} taskId={task.id} />}
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          {canEdit && (
            <Section title="Aufgabe bearbeiten">
              <TaskForm
                tenantId={tenant.id}
                projectId={project.id}
                statuses={statuses.map((entry) => ({ id: entry.id, label: entry.name }))}
                members={members.map((member) => ({ id: member.memberId, label: member.email }))}
                milestones={milestones.map((milestone) => ({ id: milestone.id, label: milestone.name }))}
                values={{
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  statusId: task.statusId,
                  priority: task.priority,
                  assigneeMemberId: task.assigneeMemberId,
                  startDate: task.startDate,
                  dueDate: task.dueDate,
                  estimateMinutes: task.estimateMinutes,
                  milestoneId: task.milestoneId,
                }}
              />
            </Section>
          )}
          <Section title="Abhängigkeiten">
            {task.dependsOn.length === 0 && task.blocks.length === 0 && <p className="text-sm text-muted-foreground">Keine Abhängigkeiten.</p>}
            {task.dependsOn.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Wartet auf</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {task.dependsOn.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2">
                      <Link href={`${base}/aufgaben/${entry.id}`} className={cn("min-w-0 flex-1 hover:underline", entry.done && "text-muted-foreground line-through")}>
                        #{entry.number} {entry.title}
                      </Link>
                      {canEdit && (
                        <RemoveDependencyButton tenantId={tenant.id} projectId={project.id} taskId={task.id} dependsOnId={entry.id} label={`#${entry.number}`} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {task.blocks.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">Blockiert</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {task.blocks.map((entry) => (
                    <li key={entry.id}>
                      <Link href={`${base}/aufgaben/${entry.id}`} className="hover:underline">
                        #{entry.number} {entry.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canEdit && (
              <DependencyForm tenantId={tenant.id} projectId={project.id} taskId={task.id} options={taskOptions.filter((option) => !linked.has(option.id))} />
            )}
          </Section>
          <p className="text-xs text-muted-foreground">
            Angelegt am {when.format(new Date(task.createdAt))}
            {task.createdBy && userNames.get(task.createdBy) ? ` von ${userNames.get(task.createdBy)}` : ""}
            {task.completedAt && ` · erledigt am ${when.format(new Date(task.completedAt))}`}
          </p>
        </div>
      </div>
    </>
  );
}

export default function TaskPage({ params }: PageProps<"/app/[tenant]/projekte/[projectId]/aufgaben/[taskId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Aufgabe wird geladen" />}>
      <TaskDetail params={params} />
    </Suspense>
  );
}
