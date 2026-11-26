import "server-only";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import type { RealtimeItem, RealtimeSnapshot } from "./realtime-types";

type Raw = Record<string, unknown>;
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0));
const items = (value: unknown): RealtimeItem[] =>
  Array.isArray(value) ? value.map((row: Raw) => ({ key: String(row.key ?? ""), visitors: num(row.visitors) })) : [];

/** Echtzeit-Daten über analytics.site_realtime() (Zugriff wird in der Datenbank geprüft). */
export const getRealtimeSnapshot = async (siteId: string): Promise<RealtimeSnapshot> => {
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("site_realtime", { p_website: siteId });
  if (error) throw error;
  const raw = (data ?? {}) as Raw;
  return {
    generatedAt: String(raw.generated_at ?? new Date().toISOString()),
    activeNow: num(raw.active_now),
    active30m: num(raw.active_30m),
    sessions30m: num(raw.sessions_30m),
    pageviews30m: num(raw.pageviews_30m),
    events30m: num(raw.events_30m),
    pageviewsPerMinute: Array.isArray(raw.pageviews_per_minute) ? raw.pageviews_per_minute.map(num) : [],
    pages: items(raw.pages),
    channels: items(raw.channels),
    countries: items(raw.countries),
    devices: items(raw.devices),
    recentEvents: Array.isArray(raw.recent_events)
      ? raw.recent_events.map((row: Raw) => ({
          type: String(row.type ?? ""),
          name: String(row.name ?? ""),
          path: String(row.path ?? ""),
          at: String(row.at ?? ""),
        }))
      : [],
  };
};
