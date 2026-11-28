import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { listMyTenants } from "@/modules/core/server/tenants";
import { buildIcs } from "@/modules/calendar/domain/calendar";
import { getEvent } from "@/modules/calendar/server/calendar";
import { toIcsEvent } from "@/modules/calendar/server/ics";

/** Einzelnen Termin als .ics herunterladen (z. B. zum Weiterleiten oder Importieren). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/app/[tenant]/kalender/termine/[eventId]/ics">) {
  const noStore = { "Cache-Control": "no-store" };
  if (!(await getCurrentUser())) return new Response("Nicht angemeldet", { status: 401, headers: noStore });
  const { tenant: slug, eventId } = await ctx.params;
  const found = (await listMyTenants()).find((entry) => entry.slug === decodeURIComponent(slug));
  const tenant = found && (await getTenantWithPermission(found.id, "calendar.view"));
  if (!tenant || !uuidSchema.safeParse(eventId).success) return new Response("Nicht gefunden", { status: 404, headers: noStore });
  const event = await getEvent(tenant.id, eventId);
  if (!event) return new Response("Nicht gefunden", { status: 404, headers: noStore });
  const ics = buildIcs(`NOVA – ${tenant.name}`, [toIcsEvent(event, tenant.timezone)]);
  return new Response(ics, {
    headers: {
      ...noStore,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="termin-${event.id.slice(0, 8)}.ics"`,
    },
  });
}
