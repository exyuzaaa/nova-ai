import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseDashboardFilters, resolveRange, todayInTimeZone } from "@/modules/analytics/domain/date-range";
import { getDataSource } from "@/modules/analytics/server/data-source-factory";
import { siteHasData } from "@/modules/analytics/server/live/supabase-reporting-client";
import { getDashboardData } from "@/modules/analytics/server/queries/dashboard";
import { getSite } from "@/modules/analytics/server/sites";
import { DashboardSkeleton } from "@/modules/analytics/ui/dashboard/dashboard-skeleton";
import { NoDataYet } from "@/modules/analytics/ui/dashboard/no-data-yet";
import { VisitorsView } from "@/modules/analytics/ui/visitors/visitors-view";

export const metadata: Metadata = { title: "Besucher" };

async function VisitorsContent({ params, searchParams }: Pick<PageProps<"/analytics/[siteId]/visitors">, "params" | "searchParams">) {
  const [{ siteId }, query] = await Promise.all([params, searchParams]);
  const site = await getSite(siteId);
  if (!site) notFound();
  if (!site.isDemo && !(await siteHasData(site.id))) return <NoDataYet site={site} />;

  const filters = parseDashboardFilters(query);
  const now = new Date();
  const dataSource = await getDataSource(site);
  const [data, distribution] = await Promise.all([
    getDashboardData(site, filters, dataSource, now, { breakdowns: false }),
    dataSource.getSessionDistribution(site.id, resolveRange(filters.preset, todayInTimeZone(site.timezone, now))),
  ]);
  return <VisitorsView data={data} distribution={distribution} />;
}

export default function VisitorsPage({ params, searchParams }: PageProps<"/analytics/[siteId]/visitors">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <VisitorsContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
