"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { formatMinutes, PRIORITIES, PRIORITY_LABELS } from "../domain/projects";
import {
  checklistAction,
  commentAction,
  createTaskAction,
  deleteTaskAction,
  dependencyAction,
  moveTaskAction,
  updateTaskAction,
} from "../server/actions/task-actions";
import { ActionButton, Textarea, textareaClass, type Option } from "./project-forms";

const IDLE: ActionState = { status: "idle" };

type Base = { tenantId: string; projectId: string };

/** Schnell eine Aufgabe (oder Unteraufgabe) anlegen. */
export function QuickTaskForm({
  tenantId,
  projectId,
  statusId,
  parentId,
  label = "Neue Aufgabe",
  placeholder = "Was ist zu tun?",
}: Base & { statusId?: string; parentId?: string; label?: string; placeholder?: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(createTaskAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      {statusId && <input type="hidden" name="statusId" value={statusId} />}
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <div className="min-w-48 flex-1">
        <FormField label={label} name="title" maxLength={300} placeholder={placeholder} error={state.fieldErrors?.title} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        Hinzufügen
      </Button>
      {state.status === "error" && state.message && (
        <p role="alert" className="basis-full text-xs text-negative">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="sr-only">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Status einer Aufgabe wechseln (Board, auch am Handy und per Tastatur). */
export function MoveTaskForm({ tenantId, projectId, taskId, title, statusId, statuses }: Base & { taskId: string; title: string; statusId: string; statuses: Option[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(moveTaskAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <NativeSelect label={`Status von ${title}`} hideLabel name="statusId" defaultValue={statusId} className="min-w-0 flex-1">
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.label}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" variant="outline" size="sm" disabled={isPending} aria-label={`${title} in gewählten Status verschieben`}>
        OK
      </Button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}

/** Abhaken: verschiebt in den ersten „Erledigt“- bzw. zurück in den ersten „Offen“-Status. */
export function ToggleDoneButton({ tenantId, projectId, taskId, title, done, targetStatusId }: Base & { taskId: string; title: string; done: boolean; targetStatusId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(moveTaskAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="contents">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="statusId" value={targetStatusId} />
      <button
        type="submit"
        disabled={isPending}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `${title} wieder öffnen` : `${title} erledigen`}
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/50 text-[11px] font-bold text-background aria-checked:border-positive aria-checked:bg-positive focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      >
        {done ? "✓" : ""}
      </button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}

export type TaskFormValues = {
  id: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: string;
  assigneeMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateMinutes: number | null;
  milestoneId: string | null;
};

export function TaskForm({ tenantId, projectId, values, statuses, members, milestones }: Base & { values: TaskFormValues; statuses: Option[]; members: Option[]; milestones: Option[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(updateTaskAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={values.id} />
      <FormMessage status={state.status} message={state.message} />
      <FormField label="Titel" name="title" defaultValue={values.title} required maxLength={300} error={errors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NativeSelect label="Status" name="status_id" defaultValue={values.statusId} error={errors.status_id}>
          {statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Priorität" name="priority" defaultValue={values.priority} error={errors.priority}>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Zuständig" name="assignee_member_id" defaultValue={values.assigneeMemberId ?? ""} error={errors.assignee_member_id}>
          <option value="">– niemand –</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Meilenstein" name="milestone_id" defaultValue={values.milestoneId ?? ""} error={errors.milestone_id}>
          <option value="">– keiner –</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.label}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Start" name="start_date" type="date" defaultValue={values.startDate ?? ""} error={errors.start_date} />
        <FormField label="Fällig am" name="due_date" type="date" defaultValue={values.dueDate ?? ""} error={errors.due_date} />
        <FormField
          label="Geschätzter Aufwand"
          name="estimate_minutes"
          defaultValue={values.estimateMinutes === null ? "" : formatMinutes(values.estimateMinutes).replace(" h", "")}
          placeholder="z. B. 1:30 oder 2,5"
          hint="Stunden:Minuten, Stunden mit Komma oder Minuten mit „m“."
          error={errors.estimate_minutes}
        />
      </div>
      <Textarea label="Beschreibung" name="description" defaultValue={values.description} maxLength={20000} rows={6} error={errors.description} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteTaskButton({ tenantId, projectId, taskId, title }: Base & { taskId: string; title: string }) {
  return (
    <ActionButton
      action={deleteTaskAction}
      fields={{ tenantId, projectId, taskId }}
      confirm={`Aufgabe „${title}“ mit Unteraufgaben, Checkliste und Kommentaren löschen?`}
      className="text-negative hover:text-negative"
    >
      Aufgabe löschen
    </ActionButton>
  );
}

// -----------------------------------------------------------------------------
// Checkliste
// -----------------------------------------------------------------------------
export function Checklist({ tenantId, projectId, taskId, items, canEdit }: Base & { taskId: string; items: { id: string; title: string; done: boolean }[]; canEdit: boolean }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(checklistAction, IDLE, { resetOnSuccess: true });
  const done = items.filter((item) => item.done).length;
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {done} von {items.length} erledigt
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {canEdit ? (
              <ActionButton
                action={checklistAction}
                fields={{ tenantId, projectId, taskId, itemId: item.id, intent: "toggle", done: item.done ? "0" : "1" }}
                label={item.done ? `${item.title} wieder öffnen` : `${item.title} abhaken`}
                className="size-7 p-0"
              >
                <span
                  aria-hidden
                  className={`flex size-4 items-center justify-center rounded border text-[10px] ${item.done ? "border-positive bg-positive text-background" : "border-muted-foreground/60"}`}
                >
                  {item.done ? "✓" : ""}
                </span>
              </ActionButton>
            ) : (
              <span aria-hidden>{item.done ? "☑" : "☐"}</span>
            )}
            <span className={`min-w-0 flex-1 ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.title}</span>
            {canEdit && (
              <ActionButton
                action={checklistAction}
                fields={{ tenantId, projectId, taskId, itemId: item.id, intent: "delete" }}
                label={`${item.title} entfernen`}
                className="text-muted-foreground"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </ActionButton>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="intent" value="add" />
          <div className="min-w-40 flex-1">
            <FormField label="Neuer Punkt" name="title" maxLength={300} error={state.fieldErrors?.title} />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            Hinzufügen
          </Button>
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Abhängigkeiten
// -----------------------------------------------------------------------------
export function DependencyForm({ tenantId, projectId, taskId, options }: Base & { taskId: string; options: Option[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(dependencyAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <NativeSelect label="Wartet auf Aufgabe" name="dependsOnId" defaultValue="" className="min-w-48 flex-1" error={state.fieldErrors?.dependsOnId}>
        <option value="">– auswählen –</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        Hinzufügen
      </Button>
      {state.status === "error" && state.message && (
        <p role="alert" className="basis-full text-xs text-negative">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function RemoveDependencyButton({ tenantId, projectId, taskId, dependsOnId, label }: Base & { taskId: string; dependsOnId: string; label: string }) {
  return (
    <ActionButton action={dependencyAction} fields={{ tenantId, projectId, taskId, dependsOnId, intent: "remove" }} label={`Abhängigkeit zu ${label} entfernen`} className="text-muted-foreground">
      <Trash2 className="size-3.5" aria-hidden />
    </ActionButton>
  );
}

// -----------------------------------------------------------------------------
// Kommentare
// -----------------------------------------------------------------------------
export function CommentForm({ tenantId, projectId, taskId }: Base & { taskId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(commentAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea label="Kommentar" name="body" maxLength={10000} rows={3} error={state.fieldErrors?.body} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          Kommentieren
        </Button>
        <FormMessage status={state.status === "success" ? "idle" : state.status} message={state.message} />
      </div>
    </form>
  );
}

export function CommentItem({
  tenantId,
  projectId,
  taskId,
  comment,
  author,
  when,
  own,
  canDelete,
}: Base & {
  taskId: string;
  comment: { id: string; body: string; editedAt: string | null };
  author: string;
  when: string;
  own: boolean;
  canDelete: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(commentAction, IDLE);
  // Bearbeiten bleibt offen, bis ein neues Ergebnis kommt (Erfolg schließt, Fehler lässt offen)
  const [openedWith, setOpenedWith] = useState<ActionState | null>(null);
  const editing = openedWith !== null && (state === openedWith || state.status === "error");
  return (
    <li className="flex flex-col gap-1 py-3" aria-label={`Kommentar von ${author}`}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{author}</span>
        <span>{when}</span>
        {comment.editedAt && <span>(bearbeitet)</span>}
      </p>
      {editing ? (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="commentId" value={comment.id} />
          <input type="hidden" name="intent" value="edit" />
          <label className="sr-only" htmlFor={`comment-${comment.id}`}>
            Kommentar bearbeiten
          </label>
          <textarea id={`comment-${comment.id}`} name="body" defaultValue={comment.body} maxLength={10000} rows={3} className={textareaClass} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              Speichern
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpenedWith(null)}>
              Abbrechen
            </Button>
          </div>
          <FormMessage status={state.status} message={state.message ?? state.fieldErrors?.body} />
        </form>
      ) : (
        <p className="text-sm whitespace-pre-line">{comment.body}</p>
      )}
      {(own || canDelete) && !editing && (
        <p className="flex gap-1">
          {own && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenedWith(state)}>
              Bearbeiten
            </Button>
          )}
          <ActionButton
            action={commentAction}
            fields={{ tenantId, projectId, taskId, commentId: comment.id, intent: "delete" }}
            confirm="Kommentar löschen?"
            className="text-negative hover:text-negative"
          >
            Löschen
          </ActionButton>
        </p>
      )}
    </li>
  );
}
