"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, hrSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import type { Permission } from "@/modules/core/domain/permissions";
import { absenceRequestSchema, absenceTypeSchema, adjustmentSchema, employeeSchema, privateSchema } from "../../domain/hr";

/* Personalmodul: Eingaben prüfen, Rechte grob prüfen; die Datenbank prüft jede Zeile (RLS,
   Funktionen mit Führungskraft-/Rechteprüfung). */

const db = async () => hrSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const hrError = (error: { code?: string; message?: string }) => {
  switch (error.code) {
    case "23P01":
      return "Für diesen Zeitraum gibt es bereits eine Abwesenheit.";
    case "23514":
      return error.message?.startsWith("Diese ") ? `${error.message}.` : "Bitte prüfe die Angaben.";
    case "23505":
      return "Diese Person ist bereits mit einem anderen Mitarbeiterprofil verknüpft.";
    case "22023":
      return error.message ? `${error.message}.` : databaseMessage(error);
    case "42501":
      return error.message && error.message !== "Keine Berechtigung" ? `${error.message}.` : FORBIDDEN;
    default:
      return databaseMessage(error);
  }
};

const tenantFor = async (formData: FormData, permission: Permission) => {
  await requireUser();
  return getTenantWithPermission(formValue(formData, "tenantId"), permission);
};

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

// -----------------------------------------------------------------------------
// Mitarbeiter
// -----------------------------------------------------------------------------
const EMPLOYEE_FIELDS = [
  "first_name",
  "last_name",
  "work_email",
  "work_phone",
  "position",
  "department_id",
  "manager_employee_id",
  "member_id",
  "employment_type",
  "entry_date",
  "exit_date",
  "weekly_hours",
  "vacation_days",
] as const;

export async function saveEmployeeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = employeeSchema.safeParse({
    ...Object.fromEntries(EMPLOYEE_FIELDS.map((key) => [key, formValue(formData, key)])),
    work_days: formData.getAll("work_days").filter((value) => typeof value === "string"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const client = await db();
  const employeeId = formValue(formData, "employeeId");
  if (employeeId) {
    if (!isUuid(employeeId)) return failure(FORBIDDEN);
    if (parsed.data.manager_employee_id === employeeId) return { status: "error", fieldErrors: { manager_employee_id: "Niemand ist sich selbst vorgesetzt." } };
    const { data, error } = await client.from("employees").update(parsed.data).eq("tenant_id", tenant.id).eq("id", employeeId).select("id");
    if (error) return failure(hrError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Mitarbeiterdaten gespeichert.");
  }
  const id = crypto.randomUUID();
  const { error } = await client.from("employees").insert({ id, tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(hrError(error));
  redirect(`${tenantBasePath(tenant.slug)}/personal/mitarbeiter/${id}`);
}

export async function deleteEmployeeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.manage");
  const employeeId = formValue(formData, "employeeId");
  if (!tenant || !isUuid(employeeId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("employees").delete().eq("tenant_id", tenant.id).eq("id", employeeId).select("id");
  if (error) return failure(hrError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(tenant.slug)}/personal`);
}

const PRIVATE_FIELDS = Object.keys(privateSchema.shape) as (keyof typeof privateSchema.shape)[];

export async function savePrivateAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.sensitive");
  const employeeId = formValue(formData, "employeeId");
  if (!tenant || !isUuid(employeeId)) return failure(FORBIDDEN);
  const parsed = privateSchema.safeParse(Object.fromEntries(PRIVATE_FIELDS.map((key) => [key, formValue(formData, key)])));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await (await db())
    .from("employee_private")
    .upsert({ employee_id: employeeId, tenant_id: tenant.id, ...parsed.data }, { onConflict: "employee_id" });
  if (error) return failure(hrError(error));
  return done("Vertrauliche Daten gespeichert.");
}

// -----------------------------------------------------------------------------
// Abwesenheiten
// -----------------------------------------------------------------------------
export async function requestAbsenceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.view");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = absenceRequestSchema.safeParse({
    employee_id: formValue(formData, "employee_id"),
    type_id: formValue(formData, "type_id"),
    start_date: formValue(formData, "start_date"),
    end_date: formValue(formData, "end_date"),
    half_day_start: formValue(formData, "half_day_start") === "1",
    half_day_end: formValue(formData, "half_day_end") === "1",
    note: formValue(formData, "note"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await (await db()).rpc("request_absence", {
    p_employee: parsed.data.employee_id,
    p_type: parsed.data.type_id,
    p_start: parsed.data.start_date,
    p_end: parsed.data.end_date,
    p_half_start: parsed.data.half_day_start,
    p_half_end: parsed.data.half_day_end,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return failure(hrError(error));
  return done("Antrag gespeichert.");
}

export async function absenceDecisionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.view");
  const absenceId = formValue(formData, "absenceId");
  if (!tenant || !isUuid(absenceId)) return failure(FORBIDDEN);
  const intent = formValue(formData, "intent");
  const client = await db();
  const { error } =
    intent === "cancel"
      ? await client.rpc("cancel_absence", { p_absence: absenceId })
      : await client.rpc("decide_absence", { p_absence: absenceId, p_approve: intent === "approve", p_note: formValue(formData, "note") || undefined });
  if (error) return failure(hrError(error));
  return done(intent === "approve" ? "Genehmigt." : intent === "reject" ? "Abgelehnt." : "Zurückgezogen.");
}

export async function adjustmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.manage");
  const employeeId = formValue(formData, "employeeId");
  if (!tenant || !isUuid(employeeId)) return failure(FORBIDDEN);
  const client = await db();
  if (formValue(formData, "intent") === "delete") {
    const { error } = await client.from("vacation_adjustments").delete().eq("tenant_id", tenant.id).eq("id", formValue(formData, "adjustmentId"));
    if (error) return failure(hrError(error));
    return done("Korrektur gelöscht.");
  }
  const parsed = adjustmentSchema.safeParse({ year: formValue(formData, "year"), days: formValue(formData, "days"), reason: formValue(formData, "reason") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await client.from("vacation_adjustments").insert({ tenant_id: tenant.id, employee_id: employeeId, ...parsed.data });
  if (error) return failure(hrError(error));
  return done("Korrektur gespeichert.");
}

// -----------------------------------------------------------------------------
// Einstellungen: Abwesenheitsarten, Feiertage; Onboarding
// -----------------------------------------------------------------------------
export async function absenceTypeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.manage");
  if (!tenant) return failure(FORBIDDEN);
  const client = await db();
  const typeId = formValue(formData, "typeId");
  if (formValue(formData, "intent") === "archive" || formValue(formData, "intent") === "restore") {
    if (!isUuid(typeId)) return failure(FORBIDDEN);
    const { error } = await client
      .from("absence_types")
      .update({ archived_at: formValue(formData, "intent") === "archive" ? new Date().toISOString() : null })
      .eq("tenant_id", tenant.id)
      .eq("id", typeId);
    if (error) return failure(hrError(error));
    return done(formValue(formData, "intent") === "archive" ? "Art ausgeblendet." : "Art wieder aktiv.");
  }
  const parsed = absenceTypeSchema.safeParse({
    name: formValue(formData, "name"),
    color: formValue(formData, "color") || "#0ea5e9",
    deducts_vacation: formValue(formData, "deducts_vacation") === "1",
    requires_approval: formValue(formData, "requires_approval") === "1",
    is_sick: formValue(formData, "is_sick") === "1",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = typeId
    ? await client.from("absence_types").update(parsed.data).eq("tenant_id", tenant.id).eq("id", typeId)
    : await client.from("absence_types").insert({ tenant_id: tenant.id, position: 100, ...parsed.data });
  if (error) return failure(error.code === "23505" ? "Diese Art gibt es schon." : hrError(error));
  return done(typeId ? "Art gespeichert." : `Art „${parsed.data.name}“ angelegt.`);
}

export async function holidayAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.manage");
  if (!tenant) return failure(FORBIDDEN);
  const date = formValue(formData, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { status: "error", fieldErrors: { date: "Bitte gib ein Datum ein." } };
  const client = await db();
  if (formValue(formData, "intent") === "delete") {
    const { error } = await client.from("public_holidays").delete().eq("tenant_id", tenant.id).eq("date", date);
    if (error) return failure(hrError(error));
    return done("Feiertag entfernt.");
  }
  const name = formValue(formData, "name").trim();
  if (!name || name.length > 80) return { status: "error", fieldErrors: { name: "Bitte gib einen Namen ein." } };
  const { error } = await client.from("public_holidays").insert({ tenant_id: tenant.id, date, name });
  if (error) return failure(error.code === "23505" ? "An diesem Tag ist schon ein Feiertag eingetragen." : hrError(error));
  return done(`Feiertag „${name}“ eingetragen.`);
}

export async function onboardingAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "hr.view");
  const employeeId = formValue(formData, "employeeId");
  if (!tenant || !isUuid(employeeId)) return failure(FORBIDDEN);
  const client = await db();
  const intent = formValue(formData, "intent");
  const taskId = formValue(formData, "taskId");
  if (intent === "add") {
    const title = formValue(formData, "title").trim();
    if (!title || title.length > 200) return { status: "error", fieldErrors: { title: "Bitte gib eine Aufgabe ein." } };
    const due = formValue(formData, "due_date");
    const assignee = formValue(formData, "assignee_member_id");
    const { error } = await client.from("onboarding_tasks").insert({
      tenant_id: tenant.id,
      employee_id: employeeId,
      title,
      due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      assignee_member_id: isUuid(assignee) ? assignee : null,
      position: Date.now() % 2_000_000_000,
    });
    if (error) return failure(hrError(error));
    return done("Aufgabe hinzugefügt.");
  }
  if (!isUuid(taskId)) return failure(FORBIDDEN);
  const request =
    intent === "delete"
      ? client.from("onboarding_tasks").delete()
      : client.from("onboarding_tasks").update({ done_at: formValue(formData, "done") === "1" ? new Date().toISOString() : null });
  const { data, error } = await request.eq("tenant_id", tenant.id).eq("id", taskId).select("id");
  if (error) return failure(hrError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done(intent === "delete" ? "Aufgabe entfernt." : "Gespeichert.");
}
