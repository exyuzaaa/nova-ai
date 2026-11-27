"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getAppOrigin } from "@/lib/app-origin";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { assignableRoles, isMemberRole } from "../../domain/roles";
import { invitationSchema, isInvitationToken, slugify, tenantSchema, uuidSchema } from "../../domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, GENERIC_ERROR, type ActionState } from "../action-state";
import { getTenant } from "../tenants";

const db = async () => coreSchema(await createSupabaseServerClient());

// -----------------------------------------------------------------------------
// Unternehmen anlegen und bearbeiten
// -----------------------------------------------------------------------------
export async function createTenantAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/onboarding");
  const parsed = tenantSchema.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const base = slugify(parsed.data.name);
  // Bei Namensgleichheit ein zufälliges Suffix anhängen (max. 3 Versuche).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;
    const { error } = await client.rpc("create_tenant", { p_name: parsed.data.name, p_slug: slug });
    if (!error) redirect("/onboarding");
    if (error.code !== "23505") return failure(databaseMessage(error));
  }
  return failure(GENERIC_ERROR);
}

export async function updateTenantAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenant(formValue(formData, "tenantId"), "admin");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = tenantSchema.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await (await db()).from("tenants").update({ name: parsed.data.name }).eq("id", tenant.id);
  if (error) return failure(databaseMessage(error));
  refresh();
  return { status: "success", message: "Unternehmen gespeichert." };
}

// -----------------------------------------------------------------------------
// Mitglieder und Einladungen
// -----------------------------------------------------------------------------
export async function inviteMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenant(formValue(formData, "tenantId"), "admin");
  if (!tenant) return failure("Nur Administratoren können einladen.");
  const parsed = invitationSchema.safeParse({ email: formValue(formData, "email"), role: formValue(formData, "role") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data: token, error } = await (await db()).rpc("create_invitation", {
    p_tenant: tenant.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return failure(databaseMessage(error));
  refresh();
  return {
    status: "success",
    message: `Einladung für ${parsed.data.email} erstellt. Der Link ist 7 Tage gültig und wird nur jetzt angezeigt.`,
    invitationLink: `${await getAppOrigin()}/einladung/${token}`,
  };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  await requireUser();
  const invitationId = formValue(formData, "invitationId");
  if (!uuidSchema.safeParse(invitationId).success) return;
  // RLS erlaubt das Löschen nur Admins des jeweiligen Unternehmens.
  await (await db()).from("invitations").delete().eq("id", invitationId);
  refresh();
}

export async function changeMemberRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenant(formValue(formData, "tenantId"));
  const role = formValue(formData, "role");
  const memberId = formValue(formData, "memberId");
  if (!tenant || !uuidSchema.safeParse(memberId).success || !isMemberRole(role)) return failure(GENERIC_ERROR);
  if (!assignableRoles(tenant.role).includes(role)) return failure("Diese Rolle darfst du nicht vergeben.");

  const { data, error } = await (await db())
    .from("tenant_members")
    .update({ role })
    .eq("id", memberId)
    .eq("tenant_id", tenant.id)
    .select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: "Rolle geändert." };
}

export async function removeMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tenant = await getTenant(formValue(formData, "tenantId"));
  const memberId = formValue(formData, "memberId");
  if (!tenant || !uuidSchema.safeParse(memberId).success) return failure(GENERIC_ERROR);

  const { data, error } = await (await db())
    .from("tenant_members")
    .delete()
    .eq("id", memberId)
    .eq("tenant_id", tenant.id)
    .select("user_id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  if (data[0].user_id === user.id) redirect("/analytics");
  refresh();
  return { status: "success", message: "Mitglied entfernt." };
}

export async function acceptInvitationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const token = formValue(formData, "token");
  await requireUser(`/einladung/${token}`);
  if (!isInvitationToken(token)) return failure("Die Einladung ist ungültig oder abgelaufen.");
  const { error } = await (await db()).rpc("accept_invitation", { p_token: token });
  if (error) return failure(databaseMessage(error));
  redirect("/analytics");
}
