"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { calendarSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { localDateTimeToUtc } from "@/modules/core/domain/time-zone";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { eventSchema } from "../../domain/calendar";

/* Termine anlegen, ändern, löschen, beantworten; iCal-Abo. Welche Kalender jemand
   bearbeiten darf, prüft die Datenbank (calendar.can_edit_calendar). */

const db = async () => calendarSchema(await createSupabaseServerClient());
const isUuid = (value: string) => uuidSchema.safeParse(value).success;

const calendarError = (error: { code?: string; message?: string }) => {
  if (error.code === "42501") return "In diesem Kalender darfst du keine Termine eintragen.";
  if (error.code === "23514") return "Bitte prüfe Beginn und Ende (höchstens 31 Tage).";
  if (error.code === "23503") return "Eine ausgewählte Person gehört nicht zu diesem Unternehmen.";
  return databaseMessage(error);
};

export async function saveEventAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "calendar.edit");
  if (!tenant) return failure(FORBIDDEN);
  const parsed = eventSchema.safeParse({
    calendar_id: formValue(formData, "calendar_id"),
    title: formValue(formData, "title"),
    description: formValue(formData, "description"),
    location: formValue(formData, "location"),
    all_day: formValue(formData, "all_day") === "1",
    start_date: formValue(formData, "start_date"),
    start_time: formValue(formData, "start_time"),
    end_date: formValue(formData, "end_date"),
    end_time: formValue(formData, "end_time"),
    repeat: formValue(formData, "repeat") || "none",
    repeat_interval: formValue(formData, "repeat_interval") || "1",
    repeat_weekdays: formData.getAll("repeat_weekdays").filter((value): value is string => typeof value === "string"),
    repeat_end: formValue(formData, "repeat_end") || "never",
    repeat_until: formValue(formData, "repeat_until"),
    repeat_count: formValue(formData, "repeat_count"),
    reminder_minutes: formValue(formData, "reminder_minutes"),
    attendees: formData.getAll("attendees").filter((value): value is string => typeof value === "string" && isUuid(value)),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { attendees, startLocal, endLocal, ...rest } = parsed.data;
  const startsAt = localDateTimeToUtc(startLocal, tenant.timezone);
  const endsAt = localDateTimeToUtc(endLocal, tenant.timezone);
  if (!startsAt || !endsAt) return { status: "error", fieldErrors: { start_time: "Diese Uhrzeit gibt es an diesem Tag nicht (Zeitumstellung)." } };
  const row = { ...rest, starts_at: startsAt, ends_at: endsAt };

  const client = await db();
  let eventId = formValue(formData, "eventId");
  if (eventId) {
    if (!isUuid(eventId)) return failure(FORBIDDEN);
    const { data, error } = await client.from("events").update(row).eq("tenant_id", tenant.id).eq("id", eventId).select("id");
    if (error) return failure(calendarError(error));
    if (data.length === 0) return failure(FORBIDDEN);
  } else {
    eventId = crypto.randomUUID();
    const { error } = await client.from("events").insert({ id: eventId, tenant_id: tenant.id, ...row });
    if (error) return failure(calendarError(error));
  }

  // Teilnehmende abgleichen (bestehende Antworten bleiben erhalten)
  const { data: current, error: currentError } = await client.from("attendees").select("member_id").eq("tenant_id", tenant.id).eq("event_id", eventId);
  if (currentError) return failure(calendarError(currentError));
  const existing = new Set(current.map((entry) => entry.member_id));
  const wanted = new Set(attendees);
  const removed = [...existing].filter((id) => !wanted.has(id));
  const added = attendees.filter((id) => !existing.has(id));
  if (removed.length > 0) {
    const { error } = await client.from("attendees").delete().eq("tenant_id", tenant.id).eq("event_id", eventId).in("member_id", removed);
    if (error) return failure(calendarError(error));
  }
  if (added.length > 0) {
    const { error } = await client.from("attendees").insert(added.map((member_id) => ({ tenant_id: tenant.id, event_id: eventId, member_id })));
    if (error) return failure(calendarError(error));
  }

  if (formValue(formData, "eventId")) {
    refresh();
    return { status: "success", message: "Termin gespeichert." };
  }
  redirect(`${tenantBasePath(tenant.slug)}/kalender/termine/${eventId}`);
}

export async function deleteEventAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "calendar.edit");
  const eventId = formValue(formData, "eventId");
  if (!tenant || !isUuid(eventId)) return failure(FORBIDDEN);
  const client = await db();
  const occurrence = formValue(formData, "occurrence");
  if (occurrence) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrence)) return failure(FORBIDDEN);
    const { error } = await client.rpc("skip_occurrence", { p_event: eventId, p_date: occurrence });
    if (error) return failure(calendarError(error));
    refresh();
    return { status: "success", message: "Dieser Termin der Serie entfällt." };
  }
  const { data, error } = await client.from("events").delete().eq("tenant_id", tenant.id).eq("id", eventId).select("id");
  if (error) return failure(calendarError(error));
  if (data.length === 0) return failure(FORBIDDEN);
  redirect(`${tenantBasePath(tenant.slug)}/kalender`);
}

export async function respondAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "calendar.view");
  const eventId = formValue(formData, "eventId");
  const response = formValue(formData, "response");
  if (!tenant || !isUuid(eventId) || !["accepted", "tentative", "declined"].includes(response)) return failure(FORBIDDEN);
  const { error } = await (await db()).rpc("respond", { p_event: eventId, p_response: response });
  if (error) return failure(calendarError(error));
  refresh();
  return { status: "success", message: response === "accepted" ? "Zugesagt." : response === "declined" ? "Abgesagt." : "Als „Vielleicht“ gespeichert." };
}

/** Abo-Link erzeugen (ersetzt einen alten) oder widerrufen. Der Link wird nur einmal angezeigt. */
export async function feedAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const tenant = await getTenantWithPermission(formValue(formData, "tenantId"), "calendar.view");
  if (!tenant) return failure(FORBIDDEN);
  const client = await db();
  if (formValue(formData, "intent") === "revoke") {
    const { error } = await client.rpc("revoke_feed_token", { p_tenant: tenant.id });
    if (error) return failure(calendarError(error));
    refresh();
    return { status: "success", message: "Abo-Link widerrufen. Kalender-Apps erhalten keine Termine mehr." };
  }
  const { data, error } = await client.rpc("create_feed_token", { p_tenant: tenant.id });
  if (error || typeof data !== "string") return failure(calendarError(error ?? {}));
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  refresh();
  return {
    status: "success",
    message: "Neuer Abo-Link erstellt. Ein älterer Link funktioniert nicht mehr.",
    invitationLink: `${protocol}://${host}/api/kalender/${data}`,
  };
}
