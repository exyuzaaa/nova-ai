import "server-only";
import { calendarSchema, createSupabaseServerClient, projectsSchema } from "@/lib/supabase/server";
import type { RepeatFrequency, Response } from "../domain/calendar";

/* Lesezugriffe des Kalenders. Sichtbarkeit prüft die Datenbank (RLS bzw. calendar.agenda). */

const db = async () => calendarSchema(await createSupabaseServerClient());

export type CalendarInfo = { id: string; kind: "personal" | "team" | "company"; name: string; color: string; canEdit: boolean };

export const listCalendars = async (tenantId: string): Promise<CalendarInfo[]> => {
  const client = await db();
  const { data, error } = await client.from("calendars").select("id, kind, name, color").eq("tenant_id", tenantId);
  if (error) throw error;
  const editable = await Promise.all(data.map((row) => client.rpc("can_edit_calendar", { p_calendar: row.id })));
  const order = { personal: 0, team: 1, company: 2 } as const;
  return data
    .map((row, index) => ({
      id: row.id,
      kind: (row.kind === "team" || row.kind === "company" ? row.kind : "personal") as CalendarInfo["kind"],
      name: row.name,
      color: row.color,
      canEdit: editable[index].data === true,
    }))
    .sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "de"));
};

export type Occurrence = {
  eventId: string;
  calendarId: string;
  calendarKind: string;
  calendarName: string;
  color: string;
  title: string;
  location: string | null;
  allDay: boolean;
  start: string;
  end: string;
  isRecurring: boolean;
  myResponse: Response | null;
  canEdit: boolean;
};

export const getAgenda = async (tenantId: string, fromUtc: string, toUtc: string): Promise<Occurrence[]> => {
  const { data, error } = await (await db()).rpc("agenda", { p_tenant: tenantId, p_from: fromUtc, p_to: toUtc });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    eventId: row.event_id,
    calendarId: row.calendar_id,
    calendarKind: row.calendar_kind,
    calendarName: row.calendar_name,
    color: row.color,
    title: row.title,
    location: row.location,
    allDay: row.all_day,
    start: row.occurrence_start,
    end: row.occurrence_end,
    isRecurring: row.is_recurring,
    myResponse: (row.my_response as Response | null) ?? null,
    canEdit: row.can_edit,
  }));
};

export type EventDetail = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  repeatFreq: RepeatFrequency | null;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
  exceptionDates: string[];
  reminderMinutes: number | null;
  createdBy: string | null;
  updatedAt: string;
  canEdit: boolean;
  attendees: { memberId: string; response: Response }[];
};

export const getEvent = async (tenantId: string, eventId: string): Promise<EventDetail | null> => {
  const client = await db();
  const { data, error } = await client
    .from("events")
    .select(
      "id, calendar_id, title, description, location, starts_at, ends_at, all_day, repeat_freq, repeat_interval, repeat_weekdays, repeat_until, repeat_count, exception_dates, reminder_minutes, created_by, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [attendees, canEdit] = await Promise.all([
    client.from("attendees").select("member_id, response").eq("tenant_id", tenantId).eq("event_id", eventId).order("created_at"),
    client.rpc("can_edit_event", { p_event: eventId }),
  ]);
  if (attendees.error) throw attendees.error;
  return {
    id: data.id,
    calendarId: data.calendar_id,
    title: data.title,
    description: data.description,
    location: data.location,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    allDay: data.all_day,
    repeatFreq: (data.repeat_freq as RepeatFrequency | null) ?? null,
    repeatInterval: data.repeat_interval,
    repeatWeekdays: data.repeat_weekdays,
    repeatUntil: data.repeat_until,
    repeatCount: data.repeat_count,
    exceptionDates: data.exception_dates,
    reminderMinutes: data.reminder_minutes,
    createdBy: data.created_by,
    updatedAt: data.updated_at,
    canEdit: canEdit.data === true,
    attendees: attendees.data.map((row) => ({ memberId: row.member_id, response: row.response as Response })),
  };
};

/** Belegte Zeiten anderer Personen (ohne Titel). */
export const getBusy = async (tenantId: string, memberIds: string[], fromUtc: string, toUtc: string) => {
  if (memberIds.length === 0) return [];
  const { data, error } = await (await db()).rpc("busy", { p_tenant: tenantId, p_members: memberIds, p_from: fromUtc, p_to: toUtc });
  if (error) throw error;
  return (data ?? []).map((row) => ({ memberId: row.member_id, start: row.starts_at, end: row.ends_at }));
};

export const hasFeedToken = async (tenantId: string): Promise<boolean> => {
  const { data } = await (await db()).rpc("has_feed_token", { p_tenant: tenantId });
  return data === true;
};

export const getMyMemberId = async (tenantId: string): Promise<string | null> => {
  const { data } = await (await db()).rpc("my_member_id", { p_tenant: tenantId });
  return typeof data === "string" ? data : null;
};

/** Eigene offene Projektaufgaben mit Fälligkeit im Zeitraum (lokale Daten, Ende exklusiv). */
export const listDueTasks = async (tenantId: string, memberId: string | null, from: string, to: string) => {
  if (!memberId) return [];
  const { data, error } = await projectsSchema(await createSupabaseServerClient())
    .from("tasks")
    .select("id, project_id, number, title, due_date, projects(name, color)")
    .eq("tenant_id", tenantId)
    .eq("assignee_member_id", memberId)
    .is("completed_at", null)
    .gte("due_date", from)
    .lt("due_date", to)
    .order("due_date")
    .limit(500);
  if (error) return [];
  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    title: row.title,
    dueDate: row.due_date as string,
    projectName: row.projects?.name ?? "",
    color: row.projects?.color ?? "#64748b",
  }));
};
