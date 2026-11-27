import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getRealtimeSnapshot } from "@/modules/analytics/server/queries/realtime";
import { getSite } from "@/modules/analytics/server/sites";
import { RealtimeView } from "@/modules/analytics/ui/realtime/realtime-view";

export const metadata: Metadata = { title: "Echtzeit" };

async function RealtimeContent({ params }: Pick<PageProps<"/analytics/[siteId]/realtime">, "params">) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();
  if (site.isDemo) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Die Echtzeit-Ansicht zeigt nur echte Besucher und ist für die Demo-Website nicht verfügbar.
      </p>
    );
  }
  return (
    <>
      <p className="-mt-2 text-sm text-muted-foreground">{site.domain}</p>
      <RealtimeView siteId={site.id} initial={await getRealtimeSnapshot(site.id)} />
    </>
  );
}

export default function RealtimePage({ params }: PageProps<"/analytics/[siteId]/realtime">) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Echtzeit</h1>
      <Suspense
        fallback={
          <div className="grid gap-3 lg:grid-cols-4" role="status" aria-busy="true" aria-label="Echtzeit wird geladen">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <RealtimeContent params={params} />
      </Suspense>
    </div>
  );
}
