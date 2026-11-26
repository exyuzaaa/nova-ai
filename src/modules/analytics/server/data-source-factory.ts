import "server-only";
import type { AnalyticsDataSource } from "./data-source";
import { demoDataSource } from "./demo/demo-data-source";
import { createLiveDataSource, type ReportingClient } from "./live/live-data-source";
import { isDemoEnabled, type Site } from "./sites";

/**
 * Wählt die Datenquelle einer Website: Demo-Websites bekommen synthetische,
 * gekennzeichnete Daten, echte Websites ausschließlich echte Daten.
 */
export const getDataSource = async (
  site: Site,
  createReportingClient: () => Promise<ReportingClient> = async () =>
    (await import("./live/supabase-reporting-client")).createSupabaseReportingClient(),
): Promise<AnalyticsDataSource> => {
  if (site.isDemo) {
    if (!isDemoEnabled()) throw new Error("Demo-Daten sind in dieser Umgebung deaktiviert.");
    return demoDataSource;
  }
  return createLiveDataSource(await createReportingClient());
};
