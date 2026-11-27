import "server-only";
import { cache } from "react";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { hasRole, type MemberRole } from "@/modules/core/domain/roles";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { listMyTenants } from "@/modules/core/server/tenants";

/**
 * Website-Verzeichnis des angemeldeten Nutzers.
 * Lesen ausschließlich über RLS: Es erscheinen nur Websites, auf die der Nutzer
 * über seine Mitgliedschaft im Unternehmen (core.tenant_members) Zugriff hat.
 */

export type Site = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  domain: string;
  timezone: string;
  isDemo: boolean;
  /** Öffentliche Tracking-ID (ns_…); Demo-Website hat keine. */
  publicSiteId: string | null;
  role: MemberRole;
};

export const DEMO_SITE: Site = {
  id: "demo",
  organizationId: "demo",
  organizationName: "Demo",
  name: "Demo GmbH",
  domain: "demo.nova-analytics.example",
  timezone: "Europe/Berlin",
  isDemo: true,
  publicSiteId: null,
  role: "viewer",
};

/**
 * Demo-Daten sind in Produktion standardmäßig AUS und müssen dort ausdrücklich
 * mit ANALYTICS_DEMO_ENABLED=true eingeschaltet werden.
 */
export const isDemoEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => {
  if (env.ANALYTICS_DEMO_ENABLED === "true") return true;
  if (env.ANALYTICS_DEMO_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
};

/** Eigene Websites (ohne Demo), sortiert nach Unternehmen und Name. */
export const listOwnSites = cache(async (): Promise<Site[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const db = analyticsSchema(await createSupabaseServerClient());

  const [websites, tenants] = await Promise.all([
    db
      .from("websites")
      .select("id, organization_id, name, domain, timezone, public_site_id, is_demo")
      .is("deleted_at", null)
      .order("name"),
    listMyTenants(),
  ]);
  if (websites.error) throw websites.error;

  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  return websites.data
    .map((row): Site | null => {
      const tenant = tenantById.get(row.organization_id);
      if (!tenant) return null;
      return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: tenant.name,
        name: row.name,
        domain: row.domain,
        timezone: row.timezone,
        isDemo: row.is_demo,
        publicSiteId: row.public_site_id,
        role: tenant.role,
      };
    })
    .filter((site): site is Site => site !== null)
    .sort((a, b) => a.organizationName.localeCompare(b.organizationName, "de") || a.name.localeCompare(b.name, "de"));
});

/** Alle für den Nutzer sichtbaren Websites inkl. Demo (falls aktiviert). */
export const listSites = async (): Promise<Site[]> => {
  const own = await listOwnSites();
  return isDemoEnabled() ? [...own, DEMO_SITE] : own;
};

export const getSite = async (siteId: string): Promise<Site | null> => {
  if (siteId === DEMO_SITE.id) return isDemoEnabled() ? DEMO_SITE : null;
  if (!uuidSchema.safeParse(siteId).success) return null;
  const sites = await listOwnSites();
  return sites.find((site) => site.id === siteId) ?? null;
};

/** Website nur zurückgeben, wenn der Nutzer mindestens die Rolle hat. */
export const getSiteWithRole = async (siteId: string, minimum: MemberRole): Promise<Site | null> => {
  const site = await getSite(siteId);
  return site && !site.isDemo && hasRole(site.role, minimum) ? site : null;
};
