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
import { activitySchema, contactSchema, customerSchema } from "../../domain/crm";
import { findDuplicates, type DuplicateCandidate } from "../customers";

/* Aktionen des CRM: Anmeldung, Mitgliedschaft und Recht werden hier geprüft,
   die Datenbank prüft jede Zeile zusätzlich per RLS (core.can). */

export type CustomerActionState = ActionState & { duplicates?: DuplicateCandidate[] };

const db = async () => crmSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const CUSTOMER_FIELDS = [
  "kind",
  "name",
  "email",
  "phone",
  "website",
  "vat_id",
  "street",
  "postal_code",
  "city",
  "country_code",
  "status",
  "category",
  "tags",
  "description",
  "owner_member_id",
] as const;

const customerInput = (formData: FormData) =>
  customerSchema.safeParse(Object.fromEntries(CUSTOMER_FIELDS.map((key) => [key, formValue(formData, key)])));

// -----------------------------------------------------------------------------
// Kunden
// -----------------------------------------------------------------------------
export async function createCustomerAction(_state: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = customerInput(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  // Dublettenprüfung: erst warnen, nach Bestätigung trotzdem anlegen
  if (formValue(formData, "confirmDuplicate") !== "1") {
    const duplicates = await findDuplicates(tenant.id, parsed.data.name, parsed.data.email);
    if (duplicates.length > 0) {
      return {
        status: "error",
        message: "Es gibt bereits ähnliche Kunden. Prüfe die Liste oder lege den Kunden trotzdem an.",
        duplicates,
      };
    }
  }

  const id = crypto.randomUUID();
  const { error } = await (await db()).from("customers").insert({ id, tenant_id: tenant.id, ...parsed.data });
  if (error) return failure(error.code === "23503" ? "Die gewählte Person gehört nicht zu diesem Unternehmen." : databaseMessage(error));
  redirect(`${tenantBasePath(tenant.slug)}/crm/kunden/${id}`);
}

export async function updateCustomerAction(_state: CustomerActionState, formData: FormData): Promise<CustomerActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const customerId = formValue(formData, "customerId");
  if (!tenant || !isUuid(customerId)) return failure(FORBIDDEN);
  const parsed = customerInput(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data, error } = await (await db())
    .from("customers")
    .update(parsed.data)
    .eq("tenant_id", tenant.id)
    .eq("id", customerId)
    .select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: "Kunde gespeichert." };
}

export async function archiveCustomerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const customerId = formValue(formData, "customerId");
  if (!tenant || !isUuid(customerId)) return failure(FORBIDDEN);
  const restore = formValue(formData, "restore") === "1";
  const { data, error } = await (await db())
    .from("customers")
    .update({ archived_at: restore ? null : new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("id", customerId)
    .select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: restore ? "Kunde wiederhergestellt." : "Kunde archiviert." };
}

export async function deleteCustomerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.manage");
  const customerId = formValue(formData, "customerId");
  if (!tenant || !isUuid(customerId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("customers").delete().eq("tenant_id", tenant.id).eq("id", customerId).select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(tenant.slug)}/crm/kunden`);
}

// -----------------------------------------------------------------------------
// Ansprechpartner
// -----------------------------------------------------------------------------
export async function saveContactAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const customerId = formValue(formData, "customerId");
  const contactId = formValue(formData, "contactId");
  if (!tenant || !isUuid(customerId) || (contactId && !isUuid(contactId))) return failure(FORBIDDEN);
  const parsed = contactSchema.safeParse({
    first_name: formValue(formData, "first_name"),
    last_name: formValue(formData, "last_name"),
    position: formValue(formData, "position"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
    is_primary: formData.get("is_primary") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  // Nur ein Hauptansprechpartner: bisherigen zuerst zurücksetzen
  if (parsed.data.is_primary) {
    await client.from("contacts").update({ is_primary: false }).eq("tenant_id", tenant.id).eq("customer_id", customerId).eq("is_primary", true);
  }
  const result = contactId
    ? await client.from("contacts").update(parsed.data).eq("tenant_id", tenant.id).eq("id", contactId).select("id")
    : await client.from("contacts").insert({ tenant_id: tenant.id, customer_id: customerId, ...parsed.data }).select("id");
  if (result.error) return failure(databaseMessage(result.error));
  if (result.data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: contactId ? "Ansprechpartner gespeichert." : "Ansprechpartner angelegt." };
}

export async function deleteContactAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const contactId = formValue(formData, "contactId");
  if (!tenant || !isUuid(contactId)) return failure(FORBIDDEN);
  const { data, error } = await (await db()).from("contacts").delete().eq("tenant_id", tenant.id).eq("id", contactId).select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure(FORBIDDEN);
  refresh();
  return { status: "success", message: "Ansprechpartner gelöscht." };
}

// -----------------------------------------------------------------------------
// Aktivitäten (Notizen, Anrufe, Termine, E-Mails, Aufgaben)
// -----------------------------------------------------------------------------
export async function createActivityAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  if (!tenant) return failure(FORBIDDEN);
  const target = {
    customer_id: formValue(formData, "customerId") || null,
    lead_id: formValue(formData, "leadId") || null,
    opportunity_id: formValue(formData, "opportunityId") || null,
  };
  if (Object.values(target).every((value) => !value) || Object.values(target).some((value) => value && !isUuid(value))) {
    return failure(FORBIDDEN);
  }
  const parsed = activitySchema.safeParse({
    kind: formValue(formData, "kind"),
    subject: formValue(formData, "subject"),
    body: formValue(formData, "body"),
    due_at: formValue(formData, "due_at"),
    assigned_member_id: formValue(formData, "assigned_member_id"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const dueAt = parsed.data.due_at ? localDateTimeToUtc(parsed.data.due_at, tenant.timezone) : null;
  const { error } = await (await db())
    .from("activities")
    .insert({ tenant_id: tenant.id, ...target, ...parsed.data, due_at: dueAt });
  if (error) return failure(error.code === "23503" ? "Die Auswahl gehört nicht zu diesem Unternehmen." : databaseMessage(error));
  refresh();
  return { status: "success", message: parsed.data.kind === "task" ? "Aufgabe angelegt." : "Eintrag gespeichert." };
}

export async function completeActivityAction(formData: FormData): Promise<void> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const activityId = formValue(formData, "activityId");
  if (!tenant || !isUuid(activityId)) return;
  const reopen = formValue(formData, "reopen") === "1";
  await (await db())
    .from("activities")
    .update({ done_at: reopen ? null : new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("id", activityId);
  refresh();
}

export async function deleteActivityAction(formData: FormData): Promise<void> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "crm.edit");
  const activityId = formValue(formData, "activityId");
  if (!tenant || !isUuid(activityId)) return;
  // RLS: eigene Einträge oder crm.manage
  await (await db()).from("activities").delete().eq("tenant_id", tenant.id).eq("id", activityId);
  refresh();
}
