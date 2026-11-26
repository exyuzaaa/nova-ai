import { Suspense } from "react";
import { redirect } from "next/navigation";
import { listOwnSites } from "@/modules/analytics/server/sites";
import { requireUser } from "@/modules/auth/server/session";

/** Einstieg: zur ersten eigenen Website, ohne Website zur Einrichtung. */
async function SiteRedirect() {
  await requireUser("/analytics");
  const sites = await listOwnSites();
  redirect(sites.length > 0 ? `/analytics/${sites[0].id}` : "/onboarding");
  return null;
}

export default function AnalyticsIndexPage() {
  return (
    <Suspense fallback={null}>
      <SiteRedirect />
    </Suspense>
  );
}
