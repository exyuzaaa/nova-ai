import Link from "next/link";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { dueState, PRIORITY_LABELS } from "../domain/projects";
import type { TaskRow } from "../server/projects";
import { ToggleDoneButton } from "./task-forms";

const date = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

/** Eine Zeile in Aufgabenlisten (Projekt, Unteraufgaben). */
export function TaskLine({
  tenantId,
  projectId,
  href,
  task,
  today,
  assignee,
  milestone,
  canEdit,
  toggleStatusId,
}: {
  tenantId: string;
  projectId: string;
  href: string;
  task: TaskRow;
  today: string;
  assignee?: string;
  milestone?: string;
  canEdit: boolean;
  toggleStatusId?: string;
}) {
  const due = dueState(task.dueDate, today, Boolean(task.completedAt));
  return (
    <li className="flex items-start gap-3 py-2.5">
      {canEdit && toggleStatusId ? (
        <span className="pt-0.5">
          <ToggleDoneButton tenantId={tenantId} projectId={projectId} taskId={task.id} title={task.title} done={Boolean(task.completedAt)} targetStatusId={toggleStatusId} />
        </span>
      ) : (
        <span className="w-5" aria-hidden />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={href} className={cn("text-sm font-medium hover:underline", task.completedAt && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">#{task.number}</span>
          {task.priority !== "normal" && (
            <span className={cn(task.priority === "urgent" && "font-medium text-negative", task.priority === "high" && "text-foreground")}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.dueDate && (
            <span className={cn(due === "overdue" && "font-medium text-negative", due === "today" && "font-medium text-foreground")}>
              {due === "overdue" ? "überfällig · " : due === "today" ? "heute · " : "bis "}
              {date.format(new Date(`${task.dueDate}T00:00:00Z`))}
            </span>
          )}
          {task.subtasks.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3" aria-hidden />
              {task.subtasks.done}/{task.subtasks.total}
              <span className="sr-only">Unteraufgaben erledigt</span>
            </span>
          )}
          {milestone && <span>◆ {milestone}</span>}
          {assignee && <span className="truncate">{assignee}</span>}
        </span>
      </span>
    </li>
  );
}
