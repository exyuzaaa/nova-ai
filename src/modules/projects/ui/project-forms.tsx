"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import {
  PROJECT_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  VISIBILITIES,
  VISIBILITY_LABELS,
  type StatusCategory,
} from "../domain/projects";
import {
  addProjectMemberAction,
  archiveProjectAction,
  createProjectAction,
  deleteProjectAction,
  deleteStatusAction,
  moveStatusAction,
  saveMilestoneAction,
  saveStatusAction,
  updateMilestoneStateAction,
  updateProjectAction,
  updateProjectMemberAction,
} from "../server/actions/project-actions";

const IDLE: ActionState = { status: "idle" };
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;
export type Option = { id: string; label: string };

export const textareaClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

/** Formular mit nur einem Knopf (Archivieren, Löschen, Verschieben …). */
export function ActionButton({
  action,
  fields,
  children,
  label,
  confirm,
  variant = "ghost",
  className,
  disabled = false,
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  label?: string;
  confirm?: string;
  variant?: "ghost" | "outline" | "default";
  className?: string;
  disabled?: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(action, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (!confirm || window.confirm(confirm)) onSubmit(event);
        else event.preventDefault();
      }}
      className="contents"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} size="sm" disabled={isPending || disabled} aria-label={label} title={label} className={className}>
        {children}
      </Button>
      {state.status === "error" && (
        <span role="alert" className="basis-full text-xs text-negative">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function Textarea({ label, name, defaultValue, maxLength, rows = 3, error }: { label: string; name: string; defaultValue?: string | null; maxLength: number; rows?: number; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={textareaClass}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Projekt anlegen / bearbeiten
// -----------------------------------------------------------------------------
export type ProjectFormValues = {
  id?: string;
  name: string;
  description: string | null;
  customerId: string | null;
  status: string;
  visibility: string;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  budgetHours: number | null;
  leadMemberId: string | null;
};

export function ProjectForm({
  tenantId,
  values,
  members,
  customers,
}: {
  tenantId: string;
  values: ProjectFormValues;
  members: Option[];
  customers: Option[] | null;
}) {
  const isNew = !values.id;
  const { state, isPending, formRef, onSubmit } = useFormAction(isNew ? createProjectAction : updateProjectAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values.id && <input type="hidden" name="projectId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <FormField label="Name" name="name" defaultValue={values.name} required maxLength={200} placeholder="z. B. Website-Relaunch" error={errors.name} />
      <Textarea label="Beschreibung" name="description" defaultValue={values.description} maxLength={10000} rows={4} error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NativeSelect label="Status" name="status" defaultValue={values.status} error={errors.status}>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Sichtbar für" name="visibility" defaultValue={values.visibility} error={errors.visibility}>
          {VISIBILITIES.map((visibility) => (
            <option key={visibility} value={visibility}>
              {VISIBILITY_LABELS[visibility]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Projektleitung" name="lead_member_id" defaultValue={values.leadMemberId ?? ""} error={errors.lead_member_id}>
          <option value="">{isNew ? "Ich selbst" : "– keine –"}</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        {customers ? (
          <NativeSelect label="Kunde (CRM)" name="customer_id" defaultValue={values.customerId ?? ""} error={errors.customer_id}>
            <option value="">– kein Kunde –</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <input type="hidden" name="customer_id" value={values.customerId ?? ""} />
        )}
        <FormField label="Start" name="start_date" type="date" defaultValue={values.startDate ?? ""} error={errors.start_date} />
        <FormField label="Ende" name="due_date" type="date" defaultValue={values.dueDate ?? ""} error={errors.due_date} />
        <FormField
          label="Budget in Stunden"
          name="budget_hours"
          inputMode="decimal"
          defaultValue={values.budgetHours === null ? "" : String(values.budgetHours).replace(".", ",")}
          placeholder="z. B. 40"
          error={errors.budget_hours}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Farbe</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((color) => (
              <label key={color} className="relative cursor-pointer">
                <input type="radio" name="color" value={color} defaultChecked={values.color === color} className="peer sr-only" />
                <span
                  className="block size-7 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="sr-only">Farbe {color}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : isNew ? "Projekt anlegen" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectDangerZone({
  tenantId,
  projectId,
  name,
  archived,
  canDelete,
}: {
  tenantId: string;
  projectId: string;
  name: string;
  archived: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionButton action={archiveProjectAction} fields={{ tenantId, projectId, archive: archived ? "0" : "1" }} variant="outline">
        {archived ? "Wiederherstellen" : "Archivieren"}
      </ActionButton>
      {canDelete && (
        <ActionButton
          action={deleteProjectAction}
          fields={{ tenantId, projectId }}
          confirm={`Projekt „${name}“ mit allen Aufgaben, Kommentaren und Zeiten endgültig löschen?`}
          className="text-negative hover:text-negative"
        >
          Endgültig löschen
        </ActionButton>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Projektmitglieder
// -----------------------------------------------------------------------------
export function ProjectMembers({
  tenantId,
  projectId,
  rows,
  candidates,
  canManage,
}: {
  tenantId: string;
  projectId: string;
  rows: { id: string; label: string; role: "manager" | "member" }[];
  candidates: Option[];
  canManage: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(addProjectMemberAction, IDLE, { resetOnSuccess: true });
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" aria-label={row.label}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{row.label}</span>
              {row.role === "manager" && (
                <Badge variant="outline" className="h-5 text-[11px]">
                  Projektleitung
                </Badge>
              )}
            </span>
            {canManage && (
              <span className="flex flex-wrap items-center gap-1">
                <ActionButton
                  action={updateProjectMemberAction}
                  fields={{ tenantId, projectId, projectMemberId: row.id, role: row.role === "manager" ? "member" : "manager" }}
                >
                  {row.role === "manager" ? "Zu Mitglied machen" : "Zur Projektleitung machen"}
                </ActionButton>
                <ActionButton
                  action={updateProjectMemberAction}
                  fields={{ tenantId, projectId, projectMemberId: row.id, intent: "remove" }}
                  label={`${row.label} aus dem Projekt entfernen`}
                  className="text-negative hover:text-negative"
                >
                  <Trash2 className="size-4" aria-hidden />
                </ActionButton>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canManage && candidates.length > 0 && (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="projectId" value={projectId} />
          <NativeSelect label="Person hinzufügen" name="memberId" defaultValue="" className="min-w-48 flex-1" error={state.fieldErrors?.memberId}>
            <option value="">– auswählen –</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect label="Rolle" name="role" defaultValue="member">
            <option value="member">Mitglied</option>
            <option value="manager">Projektleitung</option>
          </NativeSelect>
          <Button type="submit" size="sm" disabled={isPending}>
            Hinzufügen
          </Button>
          <div className="basis-full empty:hidden">
            <FormMessage status={state.status} message={state.message} />
          </div>
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Status (Spalten)
// -----------------------------------------------------------------------------
function StatusRow({
  tenantId,
  projectId,
  status,
  first,
  last,
}: {
  tenantId: string;
  projectId: string;
  status: { id: string; name: string; category: StatusCategory };
  first: boolean;
  last: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveStatusAction, IDLE);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end" aria-label={`Status ${status.name}`}>
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-1 flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="statusId" value={status.id} />
        <div className="min-w-36 flex-1">
          <FormField label="Name des Status" name="name" defaultValue={status.name} maxLength={60} required error={state.fieldErrors?.name} />
        </div>
        <NativeSelect label="Art" name="category" defaultValue={status.category}>
          {STATUS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {STATUS_CATEGORY_LABELS[category]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          Speichern
        </Button>
        <div className="basis-full empty:hidden">
          <FormMessage status={state.status} message={state.message} />
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <ActionButton action={moveStatusAction} fields={{ tenantId, projectId, statusId: status.id, direction: "up" }} label={`${status.name} nach vorne`} disabled={first}>
          <ArrowUp className="size-4" aria-hidden />
        </ActionButton>
        <ActionButton action={moveStatusAction} fields={{ tenantId, projectId, statusId: status.id, direction: "down" }} label={`${status.name} nach hinten`} disabled={last}>
          <ArrowDown className="size-4" aria-hidden />
        </ActionButton>
        <ActionButton
          action={deleteStatusAction}
          fields={{ tenantId, projectId, statusId: status.id }}
          label={`Status ${status.name} löschen`}
          confirm={`Status „${status.name}“ löschen?`}
          className="text-negative hover:text-negative"
        >
          <Trash2 className="size-4" aria-hidden />
        </ActionButton>
      </div>
    </li>
  );
}

export function StatusSettings({
  tenantId,
  projectId,
  statuses,
}: {
  tenantId: string;
  projectId: string;
  statuses: { id: string; name: string; category: StatusCategory }[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveStatusAction, IDLE, { resetOnSuccess: true });
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y">
        {statuses.map((status, index) => (
          <StatusRow key={status.id} tenantId={tenantId} projectId={projectId} status={status} first={index === 0} last={index === statuses.length - 1} />
        ))}
      </ol>
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="projectId" value={projectId} />
        <div className="min-w-36 flex-1">
          <FormField label="Neuer Status" name="name" maxLength={60} placeholder="z. B. Freigabe Kunde" error={state.fieldErrors?.name} />
        </div>
        <NativeSelect label="Art des neuen Status" name="category" defaultValue="in_progress">
          {STATUS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {STATUS_CATEGORY_LABELS[category]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" disabled={isPending}>
          Hinzufügen
        </Button>
        <div className="basis-full empty:hidden">
          <FormMessage status={state.status} message={state.message} />
        </div>
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Meilensteine
// -----------------------------------------------------------------------------
export function MilestoneForm({
  tenantId,
  projectId,
  values,
}: {
  tenantId: string;
  projectId: string;
  values?: { id: string; name: string; description: string | null; dueDate: string | null };
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveMilestoneAction, IDLE, { resetOnSuccess: !values });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="projectId" value={projectId} />
      {values && <input type="hidden" name="milestoneId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FormField label="Name des Meilensteins" name="name" defaultValue={values?.name} required maxLength={200} error={errors.name} />
        <FormField label="Fällig am" name="due_date" type="date" defaultValue={values?.dueDate ?? ""} error={errors.due_date} />
      </div>
      <Textarea label="Beschreibung" name="description" defaultValue={values?.description} maxLength={2000} rows={2} error={errors.description} />
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {values ? "Speichern" : "Meilenstein anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function MilestoneActions({ tenantId, projectId, milestoneId, name, completed }: { tenantId: string; projectId: string; milestoneId: string; name: string; completed: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <ActionButton action={updateMilestoneStateAction} fields={{ tenantId, projectId, milestoneId, intent: completed ? "reopen" : "complete" }} variant="outline">
        {completed ? "Wieder öffnen" : "Als erreicht markieren"}
      </ActionButton>
      <ActionButton
        action={updateMilestoneStateAction}
        fields={{ tenantId, projectId, milestoneId, intent: "delete" }}
        label={`Meilenstein ${name} löschen`}
        confirm={`Meilenstein „${name}“ löschen? Aufgaben bleiben erhalten.`}
        className="text-negative hover:text-negative"
      >
        <Trash2 className="size-4" aria-hidden />
      </ActionButton>
    </span>
  );
}
