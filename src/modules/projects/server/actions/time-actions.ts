"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, projectsSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { projectNameSchema, timeEntrySchema } from "../../domain/projects";
import { projectError } from "./project-actions";

/* Zeiterfassung (projects.time) und Vorlagen. Wem ein Eintrag gehört, setzt die Datenbank. */

const db = async () => projectsSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

export async function startTimerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.time");
  const projectId = formValue(formData, "projectId");
  const taskId = formValue(formData, "taskId");
  if (!tenant) return failure(FORBIDDEN);
  if (!isUuid(projectId)) return { status: "error", fieldErrors: { projectId: "Bitte wähle ein Projekt." } };
  const { error } = await (await db()).rpc("start_timer", {
    p_project: projectId,
    p_task: isUuid(taskId) ? taskId : undefined,
    p_note: formValue(formData, "note").slice(0, 1000) || undefined,
  });
  if (error) return failure(await projectError(error));
  return done("Stoppuhr läuft.");
}

export async function stopTimerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.time");
  if (!tenant) return failure(FORBIDDEN);
  const { error } = await (await db()).rpc("stop_timer", { p_tenant: tenant.id });
  if (error) return failure(await projectError(error));
  return done("Zeit gespeichert.");
}

/** Zeit nachtragen oder ändern. */
export async function saveTimeEntryAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.time");
  if (!tenant) return failure(FORBIDDEN);
  const projectId = formValue(formData, "projectId");
  if (!isUuid(projectId)) return { status: "error", fieldErrors: { projectId: "Bitte wähle ein Projekt." } };
  const parsed = timeEntrySchema.safeParse({
    date: formValue(formData, "date"),
    start: formValue(formData, "start"),
    end: formValue(formData, "end"),
    duration: formValue(formData, "duration"),
    note: formValue(formData, "note"),
    billable: formValue(formData, "billable") === "1",
    task_id: formValue(formData, "taskId"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const startedAt = localDateTimeToUtc(parsed.data.startLocal, tenant.timezone);
  if (!startedAt) return { status: "error", fieldErrors: { start: "Diese Uhrzeit gibt es an diesem Tag nicht (Zeitumstellung)." } };
  const endedAt = new Date(Date.parse(startedAt) + parsed.data.minutes * 60000).toISOString();
  const row = {
    project_id: projectId,
    task_id: parsed.data.task_id,
    started_at: startedAt,
    ended_at: endedAt,
    note: parsed.data.note,
    billable: parsed.data.billable,
  };

  const client = await db();
  const entryId = formValue(formData, "entryId");
  if (entryId) {
    if (!isUuid(entryId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("time_entries").update(row).eq("tenant_id", tenant.id).eq("id", entryId).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Zeiteintrag geändert.");
  }
  const { error } = await client.from("time_entries").insert({ tenant_id: tenant.id, ...row });
  if (error) return failure(await projectError(error));
  return done("Zeit gespeichert.");
}

export async function deleteTimeEntryAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.time");
  const entryId = formValue(formData, "entryId");
  if (!tenant || !isUuid(entryId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("time_entries").delete().eq("tenant_id", tenant.id).eq("id", entryId).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Zeiteintrag gelöscht.");
}

// -----------------------------------------------------------------------------
// Vorlagen
// -----------------------------------------------------------------------------
export async function copyProjectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const asTemplate = formValue(formData, "asTemplate") === "1";
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), asTemplate ? "projects.manage" : "projects.edit");
  const sourceId = formValue(formData, "sourceId");
  if (!tenant) return failure(FORBIDDEN);
  if (!isUuid(sourceId)) return { status: "error", fieldErrors: { sourceId: "Bitte wähle eine Vorlage." } };
  const name = projectNameSchema.safeParse(formValue(formData, "name"));
  if (!name.success) return { status: "error", fieldErrors: { name: name.error.issues[0]?.message ?? "" } };
  const start = formValue(formData, "startDate");
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) return { status: "error", fieldErrors: { startDate: "Bitte gib ein gültiges Datum ein." } };

  const { data, error } = await (await db()).rpc("copy_project", {
    p_source: sourceId,
    p_name: name.data,
    p_template: asTemplate,
    p_start: start || undefined,
  });
  if (error) return failure(await projectError(error));
  redirect(`${tenantBasePath(tenant.slug)}/projekte/${data}`);
}
