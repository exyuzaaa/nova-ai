"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { opportunitySchema } from "../../domain/crm";

/* Verkaufschancen: Anlegen, Bearbeiten, Phase wechseln, Löschen. */

const db = async () => crmSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const FIELDS = ["title", "amount", "stage_id", "probability", "expected_close_date", "owner_member_id", "lost_reason", "notes"] as const;
const input = (formData: FormData) => opportunitySchema.safeParse(Object.fromEntries(FIELDS.map((key) => [key, formValue(formData, key)])));

const relationError = (error: { code?: string; message?: string }) =>
  error.code === "23503" ? "Phase, Kunde oder zuständige Person gehören nicht zu dieser Pipeline bzw. diesem Unternehmen." : databaseMessage(error);

export async function createOpportunityAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const customerId = formValue(formData, "customerId");
  const pipelineId = formValue(formData, "pipelineId");
  if (!tenant || !isUuid(customerId) || !isUuid(pipelineId)) return failure(FORBIDDEN);
  const parsed = input(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const id = crypto.randomUUID();
  const { error } = await (await db())
    .from("opportunities")
    .insert({ id, tenant_id: tenant.id, customer_id: customerId, pipeline_id: pipelineId, ...parsed.data });
  if (error) return failure(relationError(error));
  redirect(`${tenantBasePath(tenant.slug)}/crm/verkaufschancen/${id}`);
}

export async function updateOpportunityAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const opportunityId = formValue(formData, "opportunityId");
  if (!tenant || !isUuid(opportunityId)) return failure(FORBIDDEN);
  const parsed = input(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await (await db())
    .from("opportunities")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", opportunityId)
    .select("id");
  if (error) return failure(relationError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: "Verkaufschance gespeichert." };
}

/** Phase wechseln (Kanban). Die Datenbank prüft, dass die Phase zur Pipeline gehört. */
export async function moveOpportunityAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const opportunityId = formValue(formData, "opportunityId");
  const stageId = formValue(formData, "stageId");
  if (!tenant || !isUuid(opportunityId) || !isUuid(stageId)) return failure(FORBIDDEN);
  const { data, error } = await (await db())
    .from("opportunities")
    .update({ stage_id: stageId })
    .eq("tenant_id", tenant.id)
    .eq("id", opportunityId)
    .select("id");
  if (error) return failure(relationError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: "Phase geändert." };
}

export async function deleteOpportunityAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.manage");
  const opportunityId = formValue(formData, "opportunityId");
  if (!tenant || !isUuid(opportunityId)) return failure(FORBIDDEN);
  const { data, error } = await (await db())
    .from("opportunities")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", opportunityId)
    .select("customer_id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(tenant.slug)}/crm/kunden/${data[0].customer_id}`);
}
