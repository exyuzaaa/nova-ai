"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, financeSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import type { Permission } from "@/modules/core/domain/permissions";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { articleSchema, documentSchema, lineSchema, paymentSchema, settingsSchema } from "../../domain/finance";

/* Finanzmodul: Eingaben prüfen; Ausstellen, Storno und Zahlungen laufen über geprüfte
   Datenbankfunktionen (lückenlose Nummern, Unveränderlichkeit). */

const db = async () => financeSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const financeError = (error: { code?: string; message?: string }) => {
  if ((error.code === "22023" || error.code === "23514") && error.message && !/violates|verletzt/.test(error.message)) return `${error.message}.`;
  if (error.code === "23503") return "Dieser Datensatz wird von ausgestellten Belegen verwendet.";
  return databaseMessage(error);
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
// Einstellungen und Artikel
// -----------------------------------------------------------------------------
const SETTINGS_FIELDS = Object.keys(settingsSchema.shape).filter((key) => key !== "small_business");

export async function saveSettingsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.manage");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(SETTINGS_FIELDS.map((key) => [key, formValue(formData, key)])),
    small_business: formValue(formData, "small_business") === "1",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await (await db()).from("settings").upsert({ tenant_id: tenant.id, ...parsed.data }, { onConflict: "tenant_id" });
  if (error) return failure(financeError(error));
  return done("Rechnungsdaten gespeichert.");
}

export async function saveArticleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.edit");
  if (!tenant) return failure(FORBIDDEN);
  const client = await db();
  const articleId = formValue(formData, "articleId");
  const intent = formValue(formData, "intent");
  if (intent === "archive" || intent === "restore") {
    if (!isUuid(articleId)) return failure(FORBIDDEN);
    const { error } = await client
      .from("articles")
      .update({ archived_at: intent === "archive" ? new Date().toISOString() : null })
      .eq("tenant_id", tenant.id)
      .eq("id", articleId);
    if (error) return failure(financeError(error));
    return done(intent === "archive" ? "Artikel ausgeblendet." : "Artikel wieder aktiv.");
  }
  const parsed = articleSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    unit: formValue(formData, "unit"),
    unit_price: formValue(formData, "unit_price"),
    tax_rate: formValue(formData, "tax_rate"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { error } = articleId
    ? await client.from("articles").update(parsed.data).eq("tenant_id", tenant.id).eq("id", articleId)
    : await client.from("articles").insert({ tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(financeError(error));
  return done(articleId ? "Artikel gespeichert." : `Artikel „${parsed.data.name}“ angelegt.`);
}

// -----------------------------------------------------------------------------
// Belege
// -----------------------------------------------------------------------------
export async function createDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.edit");
  if (!tenant) return failure(FORBIDDEN);
  const kind = formValue(formData, "kind") === "quote" ? "quote" : "invoice";
  const customerId = formValue(formData, "customer_id");
  if (!isUuid(customerId)) return { status: "error", fieldErrors: { customer_id: "Bitte wähle einen Kunden." } };
  const projectId = formValue(formData, "project_id");
  const id = crypto.randomUUID();
  const { error } = await (await db()).from("documents").insert({
    id,
    tenant_id: tenant.id,
    kind,
    customer_id: customerId,
    project_id: isUuid(projectId) ? projectId : null,
    title: formValue(formData, "title").trim().slice(0, 200) || null,
  });
  if (error) return failure(financeError(error));
  redirect(`${tenantBasePath(tenant.slug)}/finanzen/belege/${id}`);
}

const DOCUMENT_FIELDS = Object.keys(documentSchema.shape);

export async function updateDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.edit");
  const documentId = formValue(formData, "documentId");
  if (!tenant || !isUuid(documentId)) return failure(FORBIDDEN);
  const parsed = documentSchema.safeParse(Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, formValue(formData, key)])));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await (await db())
    .from("documents")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", documentId)
    .eq("status", "draft")
    .select("id");
  if (error) return failure(financeError(error));
  if (data.length === 0) return failure("Nur Entwürfe lassen sich bearbeiten.");
  return done("Beleg gespeichert.");
}

export async function deleteDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.edit");
  const documentId = formValue(formData, "documentId");
  if (!tenant || !isUuid(documentId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("documents").delete().eq("tenant_id", tenant.id).eq("id", documentId).eq("status", "draft").select("id");
  if (error) return failure(financeError(error));
  if (data.length === 0) return failure("Nur Entwürfe lassen sich löschen; ausgestellte Rechnungen werden storniert.");
  redirect(`${tenantBasePath(tenant.slug)}/finanzen`);
}

const LINE_FIELDS = ["title", "description", "quantity", "unit", "unit_price", "discount_percent", "tax_rate"] as const;

export async function lineAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.edit");
  const documentId = formValue(formData, "documentId");
  if (!tenant || !isUuid(documentId)) return failure(FORBIDDEN);
  const client = await db();
  const lineId = formValue(formData, "lineId");
  const intent = formValue(formData, "intent");

  if (intent === "delete" || intent === "up" || intent === "down") {
    if (!isUuid(lineId)) return failure(FORBIDDEN);
    if (intent === "delete") {
      const { error } = await client.from("document_lines").delete().eq("tenant_id", tenant.id).eq("id", lineId);
      if (error) return failure(financeError(error));
      return done("Position entfernt.");
    }
    const { data: lines, error } = await client
      .from("document_lines")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("document_id", documentId)
      .order("position")
      .order("created_at");
    if (error) return failure(financeError(error));
    const order = lines.map((line) => line.id);
    const index = order.indexOf(lineId);
    const other = index + (intent === "up" ? -1 : 1);
    if (index < 0 || other < 0 || other >= order.length) return done("Reihenfolge unverändert.");
    [order[index], order[other]] = [order[other], order[index]];
    for (const [position, id] of order.entries()) {
      const { error: updateError } = await client.from("document_lines").update({ position: position + 1 }).eq("tenant_id", tenant.id).eq("id", id);
      if (updateError) return failure(financeError(updateError));
    }
    return done("Reihenfolge geändert.");
  }

  const parsed = lineSchema.safeParse(Object.fromEntries(LINE_FIELDS.map((key) => [key, formValue(formData, key)])));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const articleId = formValue(formData, "articleId");
  if (lineId) {
    if (!isUuid(lineId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("document_lines").update(parsed.data).eq("tenant_id", tenant.id).eq("id", lineId).select("id");
    if (error) return failure(financeError(error));
    if (data.length === 0) return failure(FORBIDDEN);
    return done("Position gespeichert.");
  }
  const { count } = await client.from("document_lines").select("id", { count: "exact", head: true }).eq("document_id", documentId);
  const { error } = await client.from("document_lines").insert({
    tenant_id: tenant.id,
    document_id: documentId,
    position: (count ?? 0) + 1,
    article_id: isUuid(articleId) ? articleId : null,
    ...parsed.data,
  });
  if (error) return failure(financeError(error));
  return done("Position hinzugefügt.");
}

/** Ausstellen, Annahme/Ablehnung, Übernahme in Rechnung, Storno, Zahlungen. */
export async function documentWorkflowAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const tenant = await tenantFor(formData, "finance.view");
  const documentId = formValue(formData, "documentId");
  if (!tenant || !isUuid(documentId)) return failure(FORBIDDEN);
  const client = await db();
  const base = `${tenantBasePath(tenant.slug)}/finanzen/belege`;
  switch (formValue(formData, "intent")) {
    case "issue": {
      const { error } = await client.rpc("issue_document", { p_document: documentId });
      if (error) return failure(financeError(error));
      return done("Beleg ausgestellt. Er ist jetzt unveränderlich.");
    }
    case "accept":
    case "reject": {
      const { data, error } = await client
        .from("documents")
        .update({ status: formValue(formData, "intent") === "accept" ? "accepted" : "rejected" })
        .eq("tenant_id", tenant.id)
        .eq("id", documentId)
        .select("status");
      if (error) return failure(financeError(error));
      if (data.length === 0) return failure(FORBIDDEN);
      return done(data[0].status === "accepted" ? "Angebot als angenommen markiert." : "Angebot als abgelehnt markiert.");
    }
    case "convert": {
      const { data, error } = await client.rpc("quote_to_invoice", { p_quote: documentId });
      if (error || !data) return failure(financeError(error ?? {}));
      redirect(`${base}/${data}`);
    }
    case "cancel": {
      const { data, error } = await client.rpc("cancel_invoice", { p_invoice: documentId, p_reason: formValue(formData, "reason") });
      if (error || !data) return failure(financeError(error ?? {}));
      redirect(`${base}/${data}`);
    }
    case "payment": {
      const parsed = paymentSchema.safeParse({
        amount: formValue(formData, "amount"),
        paid_on: formValue(formData, "paid_on"),
        method: formValue(formData, "method") || "transfer",
        note: formValue(formData, "note"),
      });
      if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
      const { error } = await client.rpc("record_payment", {
        p_document: documentId,
        p_amount: parsed.data.amount,
        p_paid_on: parsed.data.paid_on,
        p_method: parsed.data.method,
        p_note: parsed.data.note ?? undefined,
      });
      if (error) return failure(financeError(error));
      return done("Zahlung erfasst.");
    }
    case "delete_payment": {
      const paymentId = formValue(formData, "paymentId");
      if (!isUuid(paymentId)) return failure(FORBIDDEN);
      const { error } = await client.rpc("delete_payment", { p_payment: paymentId });
      if (error) return failure(financeError(error));
      return done("Zahlung gelöscht.");
    }
    default:
      return failure(FORBIDDEN);
  }
}
