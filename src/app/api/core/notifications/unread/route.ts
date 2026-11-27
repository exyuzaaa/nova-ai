import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { countUnreadNotifications } from "@/modules/core/server/notifications";
import { getTenant } from "@/modules/core/server/tenants";

/** Anzahl ungelesener Benachrichtigungen (für die Glocke; Abfrage beim Fokus und jede Minute). */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401, headers });
  const tenant = await getTenant(request.nextUrl.searchParams.get("tenant") ?? "");
  if (!tenant) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
  return Response.json({ unread: await countUnreadNotifications(tenant.id) }, { headers });
}
