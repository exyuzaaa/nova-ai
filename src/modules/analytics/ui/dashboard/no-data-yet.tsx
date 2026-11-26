import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Echte Website ohne erfasste Daten. Bewusst keine leeren Diagramme oder
 * geschätzten Werte – das Dashboard erscheint, sobald Events eingehen.
 */
export function NoDataYet({
  site,
  pageviews24h = 0,
}: {
  site: { id: string; name: string; domain: string; publicSiteId: string | null };
  pageviews24h?: number;
}) {
  if (pageviews24h > 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{site.domain}</p>
        </header>
        <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted" aria-hidden>
            <Activity className="size-5 text-positive" />
          </span>
          <h2 className="text-base font-medium">Tracking aktiv: {pageviews24h} Seitenaufrufe in den letzten 24 Stunden</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Die Daten werden erfasst und sicher gespeichert. Die Auswertung mit Kennzahlen und Diagrammen folgt mit der
            nächsten Ausbaustufe (Sessions und Aggregation).
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/analytics/${site.id}/settings`}>Installationsstatus ansehen</Link>
          </Button>
        </section>
      </div>
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{site.domain}</p>
      </header>
      <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-16 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted" aria-hidden>
          <Activity className="size-5 text-muted-foreground" />
        </span>
        <h2 className="text-base font-medium">Noch keine Daten für {site.name}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Für diese Website wurden in den letzten 24 Stunden keine Besuche erfasst. Baue das Tracking-Skript aus den
          Einstellungen in deine Website ein – danach erscheinen hier die ersten Daten.
        </p>
        {site.publicSiteId && (
          <p className="text-sm text-muted-foreground">
            Tracking-ID: <code className="font-mono text-foreground">{site.publicSiteId}</code>
          </p>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/analytics/${site.id}/settings`}>Tracking einbauen</Link>
        </Button>
      </section>
    </div>
  );
}
