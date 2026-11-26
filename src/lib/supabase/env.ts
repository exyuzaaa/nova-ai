import "server-only";

/**
 * Supabase-Verbindung – ausschließlich serverseitig.
 * Bewusst ohne NEXT_PUBLIC_-Präfix: Weder URL noch Schlüssel gelangen ins Browser-Bundle.
 * Der Publishable/Anon-Key ist durch RLS abgesichert; einen Service-Role-Key benötigt
 * die App in Phase 3 nicht.
 */
export const getSupabaseEnv = (): { url: string; publishableKey: string } => {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase ist nicht konfiguriert: SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY müssen gesetzt sein (siehe .env.example).",
    );
  }
  return { url, publishableKey };
};
