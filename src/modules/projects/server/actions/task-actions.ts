"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, projectsSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { checklistItemSchema, commentSchema, quickTaskSchema, taskSchema } from "../../domain/projects";
import { projectError } from "./project-actions";

/* Aufgaben, Unteraufgaben, Checklisten, Abhängigkeiten und Kommentare.
   Bearbeiten dürfen alle mit projects.edit, die das Projekt sehen (projects.can_edit). */

const db = async () => projectsSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const context = async (formData: FormData) => {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "projects.edit");
  const projectId = formValue(formData, "projectId");
  return tenant && isUuid(projectId) ? { tenant, projectId } : null;
};

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

/** Neue Aufgabe mit Titel; Status: gewählt oder erster offener Status. */
export async function createTaskAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  if (!ctx) return failure(FORBIDDEN);
  const parsed = quickTaskSchema.safeParse({ title: formValue(formData, "title") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const parentId = formValue(formData, "parentId");
  let statusId = formValue(formData, "statusId");
  const client = await db();
  if (!isUuid(statusId)) {
    const { data } = await client
      .from("statuses")
      .select("id")
      .eq("tenant_id", ctx.tenant.id)
      .eq("project_id", ctx.projectId)
      .eq("category", "todo")
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!data) return failure("Dieses Projekt hat keinen offenen Status.");
    statusId = data.id;
  }
  const { data: last } = await client
    .from("tasks")
    .select("position")
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", ctx.projectId)
    .eq("status_id", statusId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const assignee = formValue(formData, "assigneeMemberId");
  const { error } = await client.from("tasks").insert({
    tenant_id: ctx.tenant.id,
    project_id: ctx.projectId,
    parent_id: isUuid(parentId) ? parentId : null,
    status_id: statusId,
    title: parsed.data.title,
    assignee_member_id: isUuid(assignee) ? assignee : null,
    position: (last?.position ?? 0) + 1,
  });
  if (error) return failure(await projectError(error));
  return done(parentId ? "Unteraufgabe angelegt." : `Aufgabe „${parsed.data.title}“ angelegt.`);
}

const TASK_FIELDS = ["title", "description", "status_id", "priority", "assignee_member_id", "start_date", "due_date", "estimate_minutes", "milestone_id"] as const;

export async function updateTaskAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  if (!ctx || !isUuid(taskId)) return failure(FORBIDDEN);
  const parsed = taskSchema.safeParse(Object.fromEntries(TASK_FIELDS.map((key) => [key, formValue(formData, key)])));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await (await db())
    .from("tasks")
    .update(parsed.data)
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", ctx.projectId)
    .eq("id", taskId)
    .select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Aufgabe gespeichert.");
}

/** Status wechseln (Board, Liste, Abhaken). */
export async function moveTaskAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  const statusId = formValue(formData, "statusId");
  if (!ctx || !isUuid(taskId) || !isUuid(statusId)) return failure(FORBIDDEN);
  const { error } = await (await db()).rpc("move_task", { p_task: taskId, p_status: statusId });
  if (error) return failure(await projectError(error));
  return done("Status geändert.");
}

export async function deleteTaskAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  if (!ctx || !isUuid(taskId)) return failure(FORBIDDEN);
  const { data, error } = await (await db())
    .from("tasks")
    .delete()
    .eq("tenant_id", ctx.tenant.id)
    .eq("project_id", ctx.projectId)
    .eq("id", taskId)
    .select("parent_id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure("Löschen dürfen die Projektleitung und wer die Aufgabe angelegt hat.");
  const parent = data[0].parent_id;
  const base = `${tenantBasePath(ctx.tenant.slug)}/projekte/${ctx.projectId}`;
  redirect(parent ? `${base}/aufgaben/${parent}` : base);
}

// -----------------------------------------------------------------------------
// Checkliste
// -----------------------------------------------------------------------------
export async function checklistAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  if (!ctx || !isUuid(taskId)) return failure(FORBIDDEN);
  const client = await db();
  const intent = formValue(formData, "intent");
  const itemId = formValue(formData, "itemId");

  if (intent === "add") {
    const parsed = checklistItemSchema.safeParse({ title: formValue(formData, "title") });
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
    const { count } = await client.from("checklist_items").select("id", { count: "exact", head: true }).eq("task_id", taskId);
    const { error } = await client
      .from("checklist_items")
      .insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, task_id: taskId, title: parsed.data.title, position: (count ?? 0) + 1 });
    if (error) return failure(await projectError(error));
    return done("Punkt hinzugefügt.");
  }
  if (!isUuid(itemId)) return failure(FORBIDDEN);
  const request =
    intent === "delete"
      ? client.from("checklist_items").delete()
      : client.from("checklist_items").update({ done: formValue(formData, "done") === "1" });
  const { data, error } = await request.eq("tenant_id", ctx.tenant.id).eq("task_id", taskId).eq("id", itemId).select("id");
  if (error) return failure(await projectError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done(intent === "delete" ? "Punkt entfernt." : "Checkliste aktualisiert.");
}

// -----------------------------------------------------------------------------
// Abhängigkeiten
// -----------------------------------------------------------------------------
export async function dependencyAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  const dependsOn = formValue(formData, "dependsOnId");
  if (!ctx || !isUuid(taskId)) return failure(FORBIDDEN);
  if (!isUuid(dependsOn)) return { status: "error", fieldErrors: { dependsOnId: "Bitte wähle eine Aufgabe." } };
  if (dependsOn === taskId) return { status: "error", fieldErrors: { dependsOnId: "Eine Aufgabe kann nicht auf sich selbst warten." } };
  const client = await db();
  if (formValue(formData, "intent") === "remove") {
    const { error } = await client.from("task_dependencies").delete().eq("tenant_id", ctx.tenant.id).eq("task_id", taskId).eq("depends_on_id", dependsOn);
    if (error) return failure(await projectError(error));
    return done("Abhängigkeit entfernt.");
  }
  const { error } = await client
    .from("task_dependencies")
    .insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, task_id: taskId, depends_on_id: dependsOn });
  if (error) return failure(error.code === "23505" ? "Diese Abhängigkeit gibt es schon." : await projectError(error));
  return done("Abhängigkeit hinzugefügt.");
}

// -----------------------------------------------------------------------------
// Kommentare
// -----------------------------------------------------------------------------
export async function commentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await context(formData);
  const taskId = formValue(formData, "taskId");
  if (!ctx || !isUuid(taskId)) return failure(FORBIDDEN);
  const client = await db();
  const intent = formValue(formData, "intent");
  const commentId = formValue(formData, "commentId");

  if (intent === "delete") {
    if (!isUuid(commentId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("comments").delete().eq("tenant_id", ctx.tenant.id).eq("id", commentId).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Kommentar gelöscht.");
  }
  const parsed = commentSchema.safeParse({ body: formValue(formData, "body") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (intent === "edit") {
    if (!isUuid(commentId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("comments").update(parsed.data).eq("tenant_id", ctx.tenant.id).eq("id", commentId).select("id");
    if (error) return failure(await projectError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Kommentar geändert.");
  }
  const { error } = await client
    .from("comments")
    .insert({ tenant_id: ctx.tenant.id, project_id: ctx.projectId, task_id: taskId, body: parsed.data.body });
  if (error) return failure(await projectError(error));
  return done("Kommentar gespeichert.");
}
