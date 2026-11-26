import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseDashboardFilters } from "@/modules/analytics/domain/date-range";
import { getDataSource } from "@/modules/analytics/server/data-source-factory";
import { getDashboardData } from "@/modules/analytics/server/queries/dashboard";
import { getSite } from "@/modules/analytics/server/sites";
import { DashboardSkeleton } from "@/modules/analytics/ui/dashboard/dashboard-skeleton";
import { DashboardView } from "@/modules/analytics/ui/dashboard/dashboard-view";
import { NoDataYet } from "@/modules/analytics/ui/dashboard/no-data-yet";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent({
  params,
  searchParams,
}: Pick<PageProps<"/analytics/[siteId]">, "params" | "searchParams">) {
  const [{ siteId }, query] = await Promise.all([params, searchParams]);
  const site = await getSite(siteId);
  if (!site) notFound();
  // Echte Websites: Live-Datenquelle folgt mit der Event-Erfassung – nie Demo-Daten.
  if (!site.isDemo) return <NoDataYet site={site} />;

  const filters = parseDashboardFilters(query);
  const data = await getDashboardData(site, filters, getDataSource(site), new Date());
  return <DashboardView data={data} />;
}

export default function DashboardPage({ params, searchParams }: PageProps<"/analytics/[siteId]">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
