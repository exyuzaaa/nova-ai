import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { listMyTenants } from "@/modules/core/server/tenants";
import { getDocument, getSettings } from "@/modules/finance/server/finance";
import { buildDocumentPdf } from "@/modules/finance/server/pdf";

/** Beleg als PDF (Entwürfe mit Wasserzeichen „ENTWURF“). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/app/[tenant]/finanzen/belege/[documentId]/pdf">) {
  const noStore = { "Cache-Control": "no-store" };
  if (!(await getCurrentUser())) return new Response("Nicht angemeldet", { status: 401, headers: noStore });
  const { tenant: slug, documentId } = await ctx.params;
  const found = (await listMyTenants()).find((entry) => entry.slug === decodeURIComponent(slug));
  const tenant = found && (await getTenantWithPermission(found.id, "finance.view"));
  if (!tenant || !uuidSchema.safeParse(documentId).success) return new Response("Nicht gefunden", { status: 404, headers: noStore });
  const doc = await getDocument(tenant.id, documentId);
  if (!doc) return new Response("Nicht gefunden", { status: 404, headers: noStore });
  const bytes = await buildDocumentPdf(doc, doc.seller ? null : await getSettings(tenant.id));
  const name = `${doc.number ?? `Entwurf-${doc.id.slice(0, 8)}`}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: { ...noStore, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"` },
  });
}
