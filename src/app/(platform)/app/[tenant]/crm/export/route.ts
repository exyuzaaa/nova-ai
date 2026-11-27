import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { listMyTenants } from "@/modules/core/server/tenants";
import { exportCustomers, exportLeads, logExport } from "@/modules/crm/server/export";

/**
 * CSV-Download für Kunden (?typ=kunden) und Leads (?typ=leads).
 * Recht crm.export; die Datenbank prüft jede Zeile zusätzlich per RLS.
 * Jeder Export wird im Protokoll des Unternehmens festgehalten.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/[tenant]/crm/export">) {
  const noStore = { "Cache-Control": "no-store" };
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401, headers: noStore });

  const { tenant: slug } = await ctx.params;
  const found = (await listMyTenants()).find((entry) => entry.slug === decodeURIComponent(slug));
  const tenant = found && (await getTenantWithPermission(found.id, "crm.export"));
  if (!tenant || tenant.suspended) return new Response("Nicht gefunden", { status: 404, headers: noStore });

  const type = request.nextUrl.searchParams.get("typ");
  if (type !== "kunden" && type !== "leads")
    return new Response("Unbekannter Export", {
      status: 400,
      headers: noStore,
    });

  const { csv, rows } =
    type === "kunden" ? await exportCustomers(tenant.id, tenant.timezone) : await exportLeads(tenant.id, tenant.timezone);
  await logExport(tenant.id, type === "kunden" ? "customers" : "leads", rows);

  const day = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tenant.timezone,
  }).format(new Date());
  return new Response(csv, {
    headers: {
      ...noStore,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nova-${type}-${tenant.slug}-${day}.csv"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
