"use server";

import { refresh } from "next/cache";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { NOTIFICATION_KINDS } from "../../domain/notifications";
import { uuidSchema } from "../../domain/tenant-validation";
import { databaseMessage, failure, formValue, type ActionState } from "../action-state";
import { getTenant } from "../tenants";

/* Benachrichtigungen: Die Datenbank erlaubt nur eigene Einträge (RLS), die Aktionen
   prüfen zusätzlich Anmeldung und Mitgliedschaft. */

const db = async () => coreSchema(await createSupabaseServerClient());

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = formValue(formData, "notificationId");
  if (!uuidSchema.safeParse(id).success) return;
  await (await db()).from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  refresh();
}

export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  await requireUser();
  const tenant = await getTenant(formValue(formData, "tenantId"));
  if (!tenant) return;
  await (await db())
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .is("read_at", null);
  refresh();
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = formValue(formData, "notificationId");
  if (!uuidSchema.safeParse(id).success) return;
  await (await db()).from("notifications").delete().eq("id", id);
  refresh();
}

export async function saveNotificationPreferencesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const rows = NOTIFICATION_KINDS.map(({ kind }) => ({
    user_id: user.id,
    kind,
    in_app: formData.get(`${kind}:in_app`) === "on",
    email: formData.get(`${kind}:email`) === "on",
  }));
  const { error } = await (await db()).from("notification_preferences").upsert(rows, { onConflict: "user_id,kind" });
  if (error) return failure(databaseMessage(error));
  refresh();
  return { status: "success", message: "Einstellungen gespeichert." };
}
