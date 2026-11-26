import type { NextRequest } from "next/server";
import { getRealtimeSnapshot } from "@/modules/analytics/server/queries/realtime";
import { getSite } from "@/modules/analytics/server/sites";
import { getCurrentUser } from "@/modules/auth/server/session";

/** Echtzeit-Daten einer Website für angemeldete Mitglieder (Abfrage alle 10 s durch die Ansicht). */
export async function GET(_request: NextRequest, context: RouteContext<"/api/analytics/realtime/[siteId]">) {
  const headers = { "Cache-Control": "no-store" };
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401, headers });
  const { siteId } = await context.params;
  const site = await getSite(siteId);
  if (!site || site.isDemo) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
  return Response.json(await getRealtimeSnapshot(site.id), { headers });
}
