"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, projectsSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { milestoneSchema, projectSchema, statusSchema } from "../../domain/projects";

/* Projekte einrichten. Wer was darf, entscheidet die Datenbank (projects.can_manage);
   hier werden Anmeldung, Modulrecht und Eingaben geprüft. */

const db = async () => projectsSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

/** Verständliche Meldungen für Schutzregeln der Datenbank. */
export const projectError = async (error: { code?: string; message?: string }) => {
  if (error.code === "23514" && error.message && /^(Ein |Eine |Unteraufgaben|Diese )/.test(error.message)) return `${error.message}.`;
  if (error.code === "23503") return "Der Eintrag wird noch verwendet oder die Auswahl gehört nicht zu diesem Projekt.";
  if (error.code === "23505") return "Diesen Eintrag gibt es schon.";
  return databaseMessage(error);
};

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

const PROJECT_FIELDS = ["name", "description", "customer_id", "status", "visibility", "color", "start_date", "due_date", "budget_hours", "lead_member_id"] as const;
const projectInput = (formData: FormData) =>
  projectSchema.safeParse(Object.fromEntries(PROJECT_FIELDS.map((key) => [key, formValue(formData, key)])));

/** Projekt-ID und Unternehmen mit Recht prüfen. */
const context = async (formData: FormData, permission: "projects.view" | "projects.edit" | "projects.manage") => {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), permission);
  const projectId = formValue(formData, "projectId");
  return tenant && isUuid(projectId) ? { tenant, projectId } : null;
};

// -----------------------------------------------------------------------------
// Projekte
// -----------------------------------------------------------------------------
export async function createProjectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.edit");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = projectInput(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const id = crypto.randomUUID();
  const { error } = await (await db()).from("projects").insert({ id, tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(await projectError(error));
  redirect(`${tenantBasePath(tenant.slug)}/projekte/${id}`);
}

export async function updateProjectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  if (!ctx) return failure(FORBIDDEN);
  const parsed = projectInput(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await (await db()).from("projects").update(parsed.data).eq("tenant_id", ctx.tenant.id).eq("id", ctx.projectId).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Projekt gespeichert.");
}

export async function archiveProjectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  if (!ctx) return failure(FORBIDDEN);
  const archive = formValue(formData, "archive") === "1";
  const { data, error } = await (await db())
    .from("projects")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", ctx.projectId)
    .select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done(archive ? "Projekt archiviert. Es ist jetzt schreibgeschützt." : "Projekt wiederhergestellt.");
}

export async function deleteProjectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.manage");
  if (!ctx) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("projects").delete().eq("tenant_id", ctx.tenant.id).eq("id", ctx.projectId).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(ctx.tenant.slug)}/projekte`);
}

// -----------------------------------------------------------------------------
// Projektmitglieder
// -----------------------------------------------------------------------------
export async function addProjectMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  const memberId = formValue(formData, "memberId");
  if (!ctx) return failure(FORBIDDEN);
  if (!isUuid(memberId)) return { status: "error", fieldErrors: { memberId: "Bitte wähle eine Person." } };
  const role = formValue(formData, "role") === "manager" ? "manager" : "member";
  const { error } = await (await db())
    .from("project_members")
    .insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, member_id: memberId, role });
  if (error) return failure(error.code === "23505" ? "Diese Person gehört schon zum Projekt." : await projectError(error));
  return done("Person hinzugefügt.");
}

export async function updateProjectMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  const id = formValue(formData, "projectMemberId");
  if (!ctx || !isUuid(id)) return failure(FORBIDDEN);
  const client = await db();
  if (formValue(formData, "intent") === "remove") {
    const { data, error } = await client.from("project_members").delete().eq("tenant_id", ctx.tenant.id).eq("id", id).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Person entfernt.");
  }
  const role = formValue(formData, "role") === "manager" ? "manager" : "member";
  const { data, error } = await client.from("project_members").update({ role }).eq("tenant_id", ctx.tenant.id).eq("id", id).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Rolle geändert.");
}

// -----------------------------------------------------------------------------
// Status (Spalten des Boards)
// -----------------------------------------------------------------------------
export async function saveStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  if (!ctx) return failure(FORBIDDEN);
  const parsed = statusSchema.safeParse({ name: formValue(formData, "name"), category: formValue(formData, "category") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const client = await db();
  const statusId = formValue(formData, "statusId");
  if (statusId) {
    if (!isUuid(statusId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("statuses").update(parsed.data).eq("tenant_id", ctx.tenant.id).eq("id", statusId).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Status gespeichert.");
  }
  const { data: last } = await client
    .from("statuses")
    .select("position")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", ctx.projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await client
    .from("statuses")
    .insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, position: (last?.position ?? 0) + 1, ...parsed.data });
  if (error) return failure(await projectError(error));
  return done(`Status „${parsed.data.name}“ hinzugefügt.`);
}

export async function moveStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  const statusId = formValue(formData, "statusId");
  if (!ctx || !isUuid(statusId)) return failure(FORBIDDEN);
  const client = await db();
  const { data: statuses, error } = await client
    .from("statuses")
    .select("id, position")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", ctx.projectId)
    .order("position")
    .order("created_at");
  if (error) return failure(await projectError(error));
  const index = statuses.findIndex((row) => row.id === statusId);
  const other = index + (formValue(formData, "direction") === "up" ? -1 : 1);
  if (index < 0 || other < 0 || other >= statuses.length) return done("Reihenfolge unverändert.");
  const order = statuses.map((row) => row.id);
  [order[index], order[other]] = [order[other], order[index]];
  for (const [position, id] of order.entries()) {
    const { data, error: updateError } = await client
      .from("statuses")
      .update({ position: position + 1 })
      .eq("tenant_id", ctx.tenant.id)
      .eq("id", id)
      .select("id");
    if (updateError) return failure(await projectError(updateError));
    if (data.length === 0) return failure(FORBIDDEN);
  }
  return done("Reihenfolge geändert.");
}

export async function deleteStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  const statusId = formValue(formData, "statusId");
  if (!ctx || !isUuid(statusId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("statuses").delete().eq("tenant_id", ctx.tenant.id).eq("id", statusId).select("id");
  if (error) return failure(error.code === "23503" ? "In diesem Status liegen noch Aufgaben. Verschiebe sie zuerst." : await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Status gelöscht.");
}

// -----------------------------------------------------------------------------
// Meilensteine
// -----------------------------------------------------------------------------
export async function saveMilestoneAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  if (!ctx) return failure(FORBIDDEN);
  const parsed = milestoneSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    due_date: formValue(formData, "due_date"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const client = await db();
  const milestoneId = formValue(formData, "milestoneId");
  if (milestoneId) {
    if (!isUuid(milestoneId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("milestones").update(parsed.data).eq("tenant_id", ctx.tenant.id).eq("id", milestoneId).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Meilenstein gespeichert.");
  }
  const { error } = await client.from("milestones").insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, ...parsed.data });
  if (error) return failure(await projectError(error));
  return done(`Meilenstein „${parsed.data.name}“ angelegt.`);
}

export async function updateMilestoneStateAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData, "projects.edit");
  const milestoneId = formValue(formData, "milestoneId");
  if (!ctx || !isUuid(milestoneId)) return failure(FORBIDDEN);
  const client = await db();
  const intent = formValue(formData, "intent");
  const request =
    intent === "delete"
      ? client.from("milestones").delete()
      : client.from("milestones").update({ completed_at: intent === "complete" ? new Date().toISOString() : null });
  const { data, error } = await request.eq("tenant_id", ctx.tenant.id).eq("id", milestoneId).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done(intent === "delete" ? "Meilenstein gelöscht." : intent === "complete" ? "Meilenstein erreicht." : "Meilenstein wieder offen.");
}
