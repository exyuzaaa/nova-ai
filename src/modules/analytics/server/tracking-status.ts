import "server-only";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";

export type TrackingStatus = {
  events24h: number;
  pageviews24h: number;
  sessions24h: number;
  lastEventAt: string | null;
  lastPath: string | null;
};

/** Installationsstatus der letzten 24 Stunden (nur mit Zugriff auf die Website). */
export const getTrackingStatus = async (siteId: string): Promise<TrackingStatus> => {
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("tracking_status", { p_website: siteId });
  if (error) throw error;
  const row = data?.[0];
  return {
    events24h: Number(row?.events_24h ?? 0),
    pageviews24h: Number(row?.pageviews_24h ?? 0),
    sessions24h: Number(row?.sessions_24h ?? 0),
    lastEventAt: row?.last_event_at ?? null,
    lastPath: row?.last_path ?? null,
  };
};
