"use server";

import { refresh } from "next/cache";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { departmentSchema, roleSchema, teamSchema, tenantProfileSchema } from "../../domain/admin-validation";
import { isModuleKey, isPermission, type Permission } from "../../domain/permissions";
import { uuidSchema } from "../../domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, GENERIC_ERROR, type ActionState } from "../action-state";
import { getMyPermissions, getTenantWithPermission } from "../permissions";

/*
 * Verwaltungsaktionen des Kerns. Jede Aktion prüft Anmeldung, Mitgliedschaft und
 * Recht serverseitig; die Datenbank prüft zusätzlich per RLS (core.can).
 */

const db = async () => coreSchema(await createSupabaseServerClient());

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

const fields = (formData: FormData, keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, formValue(formData, key)]));

const isUuid = (value: string) => uuidSchema.safeParse(value).success;

// -----------------------------------------------------------------------------
// Unternehmensprofil
// -----------------------------------------------------------------------------
const PROFILE_FIELDS = [
  "name",
  "legal_name",
  "street",
  "postal_code",
  "city",
  "country_code",
  "phone",
  "email",
  "website",
  "vat_id",
  "industry",
  "company_size",
  "locale",
  "timezone",
  "currency",
] as const;

export async function updateTenantProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.settings.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = tenantProfileSchema.safeParse(fields(formData, PROFILE_FIELDS));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await (await db()).from("tenants").update(parsed.data).eq("id", tenant.id);
  if (error) return failure(databaseMessage(error));
  return done("Unternehmensprofil gespeichert.");
}

// -----------------------------------------------------------------------------
// Eigene Rollen
// -----------------------------------------------------------------------------
const selectedPermissions = (formData: FormData): Permission[] =>
  [...new Set(formData.getAll("permissions").filter((value): value is string => typeof value === "string"))].filter(isPermission);

export async function createRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.roles.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = roleSchema.safeParse(fields(formData, ["name", "description"]));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const id = crypto.randomUUID();
  const { error } = await client.from("roles").insert({ id, tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(error.code === "23505" ? "Eine Rolle mit diesem Namen gibt es schon." : databaseMessage(error));

  const permissions = selectedPermissions(formData);
  if (permissions.length > 0) {
    const insert = await client
      .from("role_permissions")
      .insert(permissions.map((permission) => ({ tenant_id: tenant.id, role_id: id, permission_key: permission })));
    if (insert.error) {
      await client.from("roles").delete().eq("id", id).eq("tenant_id", tenant.id);
      return failure("Mindestens eines der Rechte darfst du nicht vergeben.");
    }
  }
  return done(`Rolle „${parsed.data.name}“ angelegt.`);
}

/** Rechte einer Rolle auf die ausgewählte Menge setzen (fehlende entfernen, neue hinzufügen). */
export async function updateRolePermissionsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.roles.manage");
  const roleId = formValue(formData, "roleId");
  if (!tenant || !isUuid(roleId)) return failure(FORBIDDEN);

  const client = await db();
  const current = await client.from("role_permissions").select("permission_key").eq("role_id", roleId).eq("tenant_id", tenant.id);
  if (current.error) return failure(databaseMessage(current.error));
  const wanted = new Set(selectedPermissions(formData));
  const existing = new Set(current.data.map((row) => row.permission_key));
  const toRemove = [...existing].filter((key) => !wanted.has(key as Permission));
  const toAdd = [...wanted].filter((key) => !existing.has(key));

  if (toRemove.length > 0) {
    const { error } = await client
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("tenant_id", tenant.id)
      .in("permission_key", toRemove);
    if (error) return failure(databaseMessage(error));
  }
  if (toAdd.length > 0) {
    const { error } = await client
      .from("role_permissions")
      .insert(toAdd.map((permission) => ({ tenant_id: tenant.id, role_id: roleId, permission_key: permission })));
    if (error) return failure("Mindestens eines der Rechte darfst du nicht vergeben.");
  }
  return done("Rechte der Rolle gespeichert.");
}

export async function deleteRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.roles.manage");
  const roleId = formValue(formData, "roleId");
  if (!tenant || !isUuid(roleId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("roles").delete().eq("id", roleId).eq("tenant_id", tenant.id).select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Rolle gelöscht.");
}

/** Eigene Rollen eines Mitglieds auf die Auswahl setzen. */
export async function setMemberRolesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.roles.manage");
  const memberId = formValue(formData, "memberId");
  if (!tenant || !isUuid(memberId)) return failure(FORBIDDEN);
  const wanted = new Set(formData.getAll("roleIds").filter((value): value is string => typeof value === "string" && isUuid(value)));

  const client = await db();
  const current = await client.from("member_roles").select("role_id").eq("member_id", memberId).eq("tenant_id", tenant.id);
  if (current.error) return failure(databaseMessage(current.error));
  const existing = new Set(current.data.map((row) => row.role_id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));

  if (toRemove.length > 0) {
    const { error } = await client.from("member_roles").delete().eq("member_id", memberId).eq("tenant_id", tenant.id).in("role_id", toRemove);
    if (error) return failure(databaseMessage(error));
  }
  if (toAdd.length > 0) {
    const { error } = await client
      .from("member_roles")
      .insert(toAdd.map((roleId) => ({ tenant_id: tenant.id, member_id: memberId, role_id: roleId })));
    if (error) return failure("Diese Rolle darfst du nicht vergeben.");
  }
  return done("Rollen gespeichert.");
}

// -----------------------------------------------------------------------------
// Abteilungen und Teams
// -----------------------------------------------------------------------------
const organizationError = (error: { code?: string; message?: string }) => {
  if (error.code === "23505") return "Dieser Name ist bereits vergeben.";
  if (error.code === "23514") return "Eine Abteilung kann nicht unter sich selbst liegen.";
  if (error.code === "23503") return "Die Auswahl gehört nicht zu diesem Unternehmen.";
  return databaseMessage(error);
};

export async function saveDepartmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.departments.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = departmentSchema.safeParse(fields(formData, ["name", "description", "parent_id", "lead_member_id"]));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const id = formValue(formData, "departmentId");
  const result = id
    ? isUuid(id)
      ? await client.from("departments").update(parsed.data).eq("id", id).eq("tenant_id", tenant.id).select("id")
      : null
    : await client.from("departments").insert({ id: crypto.randomUUID(), tenant_id: tenant.id, ...parsed.data }).select("id");
  if (!result) return failure(GENERIC_ERROR);
  if (result.error) return failure(organizationError(result.error));
  if (id && result.data.length === 0) return failure(FORBIDDEN);
  return done(id ? "Abteilung gespeichert." : `Abteilung „${parsed.data.name}“ angelegt.`);
}

export async function saveTeamAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.departments.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = teamSchema.safeParse(fields(formData, ["name", "description", "department_id", "lead_member_id"]));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const id = formValue(formData, "teamId");
  const result = id
    ? isUuid(id)
      ? await client.from("teams").update(parsed.data).eq("id", id).eq("tenant_id", tenant.id).select("id")
      : null
    : await client.from("teams").insert({ id: crypto.randomUUID(), tenant_id: tenant.id, ...parsed.data }).select("id");
  if (!result) return failure(GENERIC_ERROR);
  if (result.error) return failure(organizationError(result.error));
  if (id && result.data.length === 0) return failure(FORBIDDEN);
  return done(id ? "Team gespeichert." : `Team „${parsed.data.name}“ angelegt.`);
}

export async function deleteOrganizationUnitAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.departments.manage");
  const kind = formValue(formData, "kind");
  const id = formValue(formData, "id");
  if (!tenant || !isUuid(id) || (kind !== "department" && kind !== "team")) return failure(FORBIDDEN);
  const table = kind === "department" ? "departments" : "teams";
  const { data, error } = await (await db()).from(table).delete().eq("id", id).eq("tenant_id", tenant.id).select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done(kind === "department" ? "Abteilung gelöscht." : "Team gelöscht.");
}

export async function setTeamMembersAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "core.departments.manage");
  const teamId = formValue(formData, "teamId");
  if (!tenant || !isUuid(teamId)) return failure(FORBIDDEN);
  const wanted = new Set(formData.getAll("memberIds").filter((value): value is string => typeof value === "string" && isUuid(value)));

  const client = await db();
  const current = await client.from("team_members").select("member_id").eq("team_id", teamId).eq("tenant_id", tenant.id);
  if (current.error) return failure(databaseMessage(current.error));
  const existing = new Set(current.data.map((row) => row.member_id));
  const toRemove = [...existing].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !existing.has(id));
  if (toRemove.length > 0) {
    const { error } = await client.from("team_members").delete().eq("team_id", teamId).eq("tenant_id", tenant.id).in("member_id", toRemove);
    if (error) return failure(databaseMessage(error));
  }
  if (toAdd.length > 0) {
    const { error } = await client
      .from("team_members")
      .insert(toAdd.map((memberId) => ({ tenant_id: tenant.id, team_id: teamId, member_id: memberId })));
    if (error) return failure(organizationError(error));
  }
  return done("Teammitglieder gespeichert.");
}

// -----------------------------------------------------------------------------
// Module
// -----------------------------------------------------------------------------
export async function setModuleEnabledAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenantId = formValue(formData, "tenantId");
  const moduleKey = formValue(formData, "module");
  const enabled = formValue(formData, "enabled") === "true";
  if (!isUuid(tenantId) || !isModuleKey(moduleKey)) return failure(GENERIC_ERROR);
  if (!(await getMyPermissions(tenantId)).has("core.modules.manage")) return failure(FORBIDDEN);

  const { error } = await (await db()).rpc("set_module_enabled", { p_tenant: tenantId, p_module: moduleKey, p_enabled: enabled });
  if (error) return failure(error.code === "22023" ? (error.message ?? GENERIC_ERROR) : databaseMessage(error));
  return done(enabled ? "Modul eingeschaltet." : "Modul ausgeschaltet.");
}
