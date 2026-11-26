import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * Angemeldeter Nutzer der aktuellen Anfrage (einmal pro Anfrage aufgelöst).
 * getClaims() prüft das JWT; bei symmetrischen Schlüsseln fragt es den Auth-Server.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

/** Für geschützte Bereiche: ohne Anmeldung zur Login-Seite. */
export const requireUser = async (nextPath?: string): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
};
