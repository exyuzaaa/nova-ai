import "server-only";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { isNotificationKind, NOTIFICATION_KINDS, type NotificationKind } from "../domain/notifications";

const db = async () => coreSchema(await createSupabaseServerClient());

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export const NOTIFICATION_PAGE_SIZE = 50;

/** Eigene Benachrichtigungen in einem Unternehmen (RLS: nur eigene, nur als Mitglied). */
export const listNotifications = async (tenantId: string, limit = NOTIFICATION_PAGE_SIZE): Promise<Notification[]> => {
  const { data, error } = await (await db())
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
};

export const countUnreadNotifications = async (tenantId: string): Promise<number> => {
  const { count, error } = await (await db())
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
};

export type NotificationPreference = { kind: NotificationKind; label: string; description: string; inApp: boolean; email: boolean };

/** Einstellungen je Art; ohne gespeicherte Zeile gelten die Standards (In-App an, E-Mail aus). */
export const listNotificationPreferences = async (): Promise<NotificationPreference[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await (await db()).from("notification_preferences").select("kind, in_app, email").eq("user_id", user.id);
  if (error) throw error;
  const saved = new Map(data.filter((row) => isNotificationKind(row.kind)).map((row) => [row.kind, row]));
  return NOTIFICATION_KINDS.map((entry) => ({
    kind: entry.kind,
    label: entry.label,
    description: entry.description,
    inApp: saved.get(entry.kind)?.in_app ?? true,
    email: saved.get(entry.kind)?.email ?? false,
  }));
};
