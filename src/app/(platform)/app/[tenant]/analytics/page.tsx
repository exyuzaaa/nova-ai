import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { hasRole } from "@/modules/core/domain/roles";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listOwnSites } from "@/modules/analytics/server/sites";

/**
 * Einstieg in das Modul Analytics für ein Unternehmen: zur ersten Website dieses
 * Unternehmens, ohne Website zur Einrichtung (nur Admins) – sonst 404.
 */
async function AnalyticsRedirect({ params }: Pick<PageProps<"/app/[tenant]/analytics">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "analytics.view");
  const site = (await listOwnSites()).find((entry) => entry.organizationId === tenant.id);
  if (site) redirect(`/analytics/${site.id}`);
  if (hasRole(tenant.role, "admin")) redirect("/onboarding?neu=website");
  notFound();
  return null;
}

export default function TenantAnalyticsPage({ params }: PageProps<"/app/[tenant]/analytics">) {
  return (
    <Suspense fallback={null}>
      <AnalyticsRedirect params={params} />
    </Suspense>
  );
}
