import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Ziel, wenn die Datenbank eine Sitzung nicht mehr akzeptiert (auf einem anderen Gerät
 * abgemeldet). Entfernt die lokalen Sitzungs-Cookies und führt zur Anmeldung.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login?hinweis=sitzung-beendet", request.url));
}
