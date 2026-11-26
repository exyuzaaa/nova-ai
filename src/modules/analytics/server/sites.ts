import "server-only";
import { cache } from "react";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { hasRole, isMemberRole, type MemberRole } from "../domain/roles";
import { uuidSchema } from "../domain/tenancy-validation";

/**
 * Website-Verzeichnis des angemeldeten Nutzers.
 * Lesen ausschließlich über RLS: Es erscheinen nur Websites, auf die der Nutzer
 * über seine Organisationsmitgliedschaft Zugriff hat.
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

/** Eigene Websites (ohne Demo), sortiert nach Organisation und Name. */
export const listOwnSites = cache(async (): Promise<Site[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const db = analyticsSchema(await createSupabaseServerClient());

  const [websites, memberships] = await Promise.all([
    db
      .from("websites")
      .select("id, organization_id, name, domain, timezone, public_site_id, is_demo, organizations(name)")
      .is("deleted_at", null)
      .order("name"),
    db.from("organization_members").select("organization_id, role").eq("user_id", user.id),
  ]);
  if (websites.error) throw websites.error;
  if (memberships.error) throw memberships.error;

  const roleByOrg = new Map(memberships.data.map((row) => [row.organization_id, row.role]));
  return websites.data
    .map((row): Site | null => {
      const role = roleByOrg.get(row.organization_id);
      if (!isMemberRole(role)) return null;
      return {
        id: row.id,
        organizationId: row.organization_id,
        organizationName: row.organizations?.name ?? "",
        name: row.name,
        domain: row.domain,
        timezone: row.timezone,
        isDemo: row.is_demo,
        publicSiteId: row.public_site_id,
        role,
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
