import "server-only";
import type { AnalyticsDataSource } from "./data-source";
import { demoDataSource } from "./demo/demo-data-source";
import { isDemoEnabled, type Site } from "./sites";

export class LiveDataSourceUnavailableError extends Error {
  constructor(siteId: string) {
    super(`Für die Website ${siteId} ist noch keine Live-Datenquelle angebunden (folgt in Phase 5).`);
    this.name = "LiveDataSourceUnavailableError";
  }
}

/**
 * Wählt die Datenquelle einer Website. Es gibt bewusst KEINEN Rückfall auf
 * Demo-Daten: echte Websites bekommen nie synthetische Werte.
 */
export const getDataSource = (site: Site): AnalyticsDataSource => {
  if (site.isDemo) {
    if (!isDemoEnabled()) throw new Error("Demo-Daten sind in dieser Umgebung deaktiviert.");
    return demoDataSource;
  }
  throw new LiveDataSourceUnavailableError(site.id);
};
