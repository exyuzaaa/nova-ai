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
