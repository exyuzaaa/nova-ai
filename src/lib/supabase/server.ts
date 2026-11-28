import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase-Client für Server Components, Server Actions und Route Handler.
 * Läuft mit der Sitzung des angemeldeten Nutzers – RLS greift bei jeder Abfrage.
 * Pro Anfrage neu erzeugen, nie zwischen Anfragen teilen.
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // In Server Components sind Cookies schreibgeschützt; die Sitzung erneuert proxy.ts.
        }
      },
    },
  });
};

export const analyticsSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) =>
  client.schema("analytics");

/** Gemeinsamer Kern: Unternehmen, Mitglieder, Einladungen, Audit-Log. */
export const coreSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) =>
  client.schema("core");

/** Modul CRM: Kunden, Ansprechpartner, Leads, Pipelines, Verkaufschancen, Aktivitäten. */
export const crmSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) => client.schema("crm");

/** Zugriff auf das Schema hr (RLS: Verzeichnis mit hr.view, vertrauliche Daten mit hr.sensitive). */
export const hrSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) => client.schema("hr");

/** Zugriff auf das Schema calendar (RLS: Kalender-Sichtbarkeit, Einladungen). */
export const calendarSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) => client.schema("calendar");

/** Zugriff auf das Schema projects (RLS: core.can + Sichtbarkeit des Projekts). */
export const projectsSchema = (client: Awaited<ReturnType<typeof createSupabaseServerClient>>) => client.schema("projects");
