"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { leadSchema } from "../../domain/crm";

/* Leads: Anlegen, Bearbeiten, Löschen, Umwandeln. Rechteprüfung hier und per RLS. */

const db = async () => crmSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const LEAD_FIELDS = [
  "title",
  "company_name",
  "contact_name",
  "email",
  "phone",
  "source",
  "status",
  "score",
  "estimated_value",
  "owner_member_id",
  "follow_up_at",
  "notes",
] as const;

const leadInput = (formData: FormData, timeZone: string) => {
  const parsed = leadSchema.safeParse(Object.fromEntries(LEAD_FIELDS.map((key) => [key, formValue(formData, key)])));
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { ...parsed.data, follow_up_at: parsed.data.follow_up_at ? localDateTimeToUtc(parsed.data.follow_up_at, timeZone) : null },
  };
};

const relationError = (error: { code?: string; message?: string }) =>
  error.code === "23503" ? "Die gewählte Person gehört nicht zu diesem Unternehmen." : databaseMessage(error);

export async function createLeadAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = leadInput(formData, tenant.timezone);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const id = crypto.randomUUID();
  const { error } = await (await db()).from("leads").insert({ id, tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(relationError(error));
  redirect(`${tenantBasePath(tenant.slug)}/crm/leads/${id}`);
}

export async function updateLeadAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const leadId = formValue(formData, "leadId");
  if (!tenant || !isUuid(leadId)) return failure(FORBIDDEN);
  const parsed = leadInput(formData, tenant.timezone);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  // Umgewandelte Leads bleiben unverändert (Nachweis der Herkunft)
  const { data, error } = await (await db())
    .from("leads")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", leadId)
    .neq("status", "converted")
    .select("id");
  if (error) return failure(relationError(error));
  if (data.length === 0) return failure("Dieser Lead kann nicht mehr geändert werden.");
  refresh();
  return { status: "success", message: "Lead gespeichert." };
}

export async function deleteLeadAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.manage");
  const leadId = formValue(formData, "leadId");
  if (!tenant || !isUuid(leadId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("leads").delete().eq("tenant_id", tenant.id).eq("id", leadId).select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(tenant.slug)}/crm/leads`);
}

export async function convertLeadAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const leadId = formValue(formData, "leadId");
  const customerId = formValue(formData, "customerId");
  if (!tenant || !isUuid(leadId) || (customerId && !isUuid(customerId))) return failure(FORBIDDEN);

  const { data, error } = await (await db()).rpc("convert_lead", {
    p_lead: leadId,
    p_customer: customerId || undefined,
    p_create_opportunity: formData.get("createOpportunity") === "on",
  });
  if (error) {
    if (error.code === "22023") return failure("Dieser Lead wurde bereits umgewandelt.");
    if (error.code === "P0002") return failure("Lead oder Kunde wurde nicht gefunden.");
    return failure(databaseMessage(error));
  }
  redirect(`${tenantBasePath(tenant.slug)}/crm/kunden/${data}`);
}
