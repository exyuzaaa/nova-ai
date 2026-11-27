import "server-only";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";

export type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export const SEARCH_MAX_QUERY = 200;

/** Globale Suche in einem Unternehmen. Die Datenbank liefert nur Treffer, für die Rechte bestehen. */
export const searchTenant = async (tenantId: string, query: string): Promise<SearchResult[]> => {
  const term = query.trim().slice(0, SEARCH_MAX_QUERY);
  if (term.length === 0) return [];
  const { data, error } = await (await coreSchema(await createSupabaseServerClient())).rpc("search", {
    p_tenant: tenantId,
    p_query: term,
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    type: row.entity_type,
    id: row.entity_id,
    title: row.title,
    subtitle: row.subtitle,
    href: row.href,
  }));
};
