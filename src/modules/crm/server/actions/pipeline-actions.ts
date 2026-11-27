"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { pipelineNameSchema, stageSchema } from "../../domain/crm";

/* Pipeline- und Phasen-Einstellungen (Recht crm.manage). Schutzregeln – z. B. dass
   „Gewonnen“/„Verloren“ bleiben – erzwingt zusätzlich die Datenbank. */

const db = async () => crmSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const settingsError = (error: { code?: string; message?: string }) => {
  switch (error.code) {
    case "23503":
      return "Hier liegen noch Verkaufschancen. Verschiebe oder lösche sie zuerst.";
    case "23505":
      return "Eine Pipeline mit diesem Namen gibt es schon.";
    case "23514":
      // Eigene, verständliche Meldungen aus crm.protect_stage / crm.protect_default_pipeline
      return error.message?.startsWith("Die ") || error.message?.startsWith("Eine ") || error.message?.startsWith("Art ")
        ? `${error.message}.`
        : databaseMessage(error);
    default:
      return databaseMessage(error);
  }
};

const managedTenant = async (formData: FormData) => {
  await requireUser();
  return getTenantWithPermission(formValue(formData, "tenantId"), "crm.manage");
};

const done = (message: string): ActionState => {
  refresh();
  return { status: "success", message };
};

// -----------------------------------------------------------------------------
// Pipelines
// -----------------------------------------------------------------------------
export async function createPipelineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  if (!tenant) return failure(FORBIDDEN);
  const name = pipelineNameSchema.safeParse(formValue(formData, "name"));
  if (!name.success)
    return {
      status: "error",
      fieldErrors: { name: name.error.issues[0]?.message ?? "" },
    };
  const { error } = await (await db()).rpc("create_pipeline", { p_tenant: tenant.id, p_name: name.data });
  if (error) return failure(settingsError(error));
  return done(`Pipeline „${name.data}“ angelegt.`);
}

export async function renamePipelineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const pipelineId = formValue(formData, "pipelineId");
  if (!tenant || !isUuid(pipelineId)) return failure(FORBIDDEN);
  const name = pipelineNameSchema.safeParse(formValue(formData, "name"));
  if (!name.success)
    return {
      status: "error",
      fieldErrors: { name: name.error.issues[0]?.message ?? "" },
    };
  const { data, error } = await (await db())
    .from("pipelines")
    .update({ name: name.data })
    .eq("tenant_id", tenant.id)
    .eq("id", pipelineId)
    .select("id");
  if (error) return failure(settingsError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Name gespeichert.");
}

export async function setDefaultPipelineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const pipelineId = formValue(formData, "pipelineId");
  if (!tenant || !isUuid(pipelineId)) return failure(FORBIDDEN);
  const { error } = await (await db()).rpc("set_default_pipeline", { p_pipeline: pipelineId });
  if (error) return failure(settingsError(error));
  return done("Standard-Pipeline geändert.");
}

export async function deletePipelineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const pipelineId = formValue(formData, "pipelineId");
  if (!tenant || !isUuid(pipelineId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("pipelines").delete().eq("tenant_id", tenant.id).eq("id", pipelineId).select("id");
  if (error) return failure(settingsError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Pipeline gelöscht.");
}

// -----------------------------------------------------------------------------
// Phasen
// -----------------------------------------------------------------------------
export async function addStageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const pipelineId = formValue(formData, "pipelineId");
  if (!tenant || !isUuid(pipelineId)) return failure(FORBIDDEN);
  const parsed = stageSchema.safeParse({
    name: formValue(formData, "name"),
    probability: formValue(formData, "probability"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const { data: last } = await client
    .from("pipeline_stages")
    .select("position")
    .eq("tenant_id", tenant.id)
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await client.from("pipeline_stages").insert({
    tenant_id: tenant.id,
    pipeline_id: pipelineId,
    kind: "open",
    position: (last?.position ?? 0) + 1,
    ...parsed.data,
  });
  if (error) return failure(settingsError(error));
  return done(`Phase „${parsed.data.name}“ hinzugefügt.`);
}

export async function updateStageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const stageId = formValue(formData, "stageId");
  if (!tenant || !isUuid(stageId)) return failure(FORBIDDEN);
  // Bei „Gewonnen“/„Verloren“ ist die Wahrscheinlichkeit fest (100 / 0) und wird nicht gesendet
  const fixed = formValue(formData, "probability") === "";
  const parsed = stageSchema.safeParse({
    name: formValue(formData, "name"),
    probability: fixed ? "0" : formValue(formData, "probability"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await (
    await db()
  )
    .from("pipeline_stages")
    .update(fixed ? { name: parsed.data.name } : parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", stageId)
    .select("id");
  if (error) return failure(settingsError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Phase gespeichert.");
}

export async function moveStageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const stageId = formValue(formData, "stageId");
  if (!tenant || !isUuid(stageId)) return failure(FORBIDDEN);
  const { error } = await (
    await db()
  ).rpc("move_stage", {
    p_stage: stageId,
    p_up: formValue(formData, "direction") === "up",
  });
  if (error) return failure(settingsError(error));
  return done("Reihenfolge geändert.");
}

export async function deleteStageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await managedTenant(formData);
  const stageId = formValue(formData, "stageId");
  if (!tenant || !isUuid(stageId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("pipeline_stages").delete().eq("tenant_id", tenant.id).eq("id", stageId).select("id");
  if (error) return failure(settingsError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  return done("Phase gelöscht.");
}
