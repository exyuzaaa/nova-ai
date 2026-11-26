import "server-only";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReportingClient } from "./live-data-source";

/** Auswertung über Supabase mit der Sitzung des angemeldeten Nutzers. */
export const createSupabaseReportingClient = async (): Promise<ReportingClient> => {
  const db = analyticsSchema(await createSupabaseServerClient());
  return {
    async dailyStats(siteId, start, end) {
      const { data, error } = await db.rpc("site_daily_stats", { p_website: siteId, p_start: start, p_end: end });
      if (error) throw error;
      return data ?? [];
    },
    async breakdown(siteId, start, end, dimension, limit) {
      const { data, error } = await db.rpc("site_breakdown", {
        p_website: siteId,
        p_start: start,
        p_end: end,
        p_dimension: dimension,
        p_limit: limit,
      });
      if (error) throw error;
      return data ?? [];
    },
    async distribution(siteId, start, end) {
      const { data, error } = await db.rpc("site_session_distribution", { p_website: siteId, p_start: start, p_end: end });
      if (error) throw error;
      return data ?? [];
    },
  };
};

export const siteHasData = async (siteId: string): Promise<boolean> => {
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("site_has_data", { p_website: siteId });
  if (error) throw error;
  return Boolean(data);
};
