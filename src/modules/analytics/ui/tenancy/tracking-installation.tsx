import Link from "next/link";
import { CircleCheck, CircleDashed } from "lucide-react";
import type { TrackingStatus } from "../../server/tracking-status";
import { CopyButton } from "../components/copy-button";

const relativeTime = (iso: string, now: Date): string => {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  return `vor ${hours} Std.`;
};

/** Einbau-Code, Installationsstatus und (falls passend) Link zur Testseite. */
export function TrackingInstallation({
  snippet,
  status,
  testUrl,
  now,
}: {
  snippet: string;
  status: TrackingStatus;
  testUrl: string | null;
  now: Date;
}) {
  const active = status.events24h > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          Füge diese Zeile in den <code className="font-mono text-xs">&lt;head&gt;</code> jeder Seite deiner Website ein:
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs" data-testid="tracking-snippet">
          {snippet}
        </pre>
        <div>
          <CopyButton value={snippet} label="Code kopieren" />
        </div>
      </div>

      <div
        role="status"
        className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
        data-testid="tracking-status"
      >
        {active ? (
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
        ) : (
          <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div>
          {active ? (
            <>
              <p className="font-medium">Tracking aktiv</p>
              <p className="text-muted-foreground">
                Letzte 24 Stunden: {status.pageviews24h} Seitenaufrufe, {status.events24h} Events, {status.sessions24h} Sessions.
                {status.lastEventAt && ` Letzter Empfang ${relativeTime(status.lastEventAt, now)}`}
                {status.lastPath && ` (${status.lastPath})`}.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Noch keine Daten empfangen</p>
              <p className="text-muted-foreground">
                Nach dem Einbau die Website einmal aufrufen und diese Seite neu laden. Werbeblocker und „Do Not Track“
                im eigenen Browser verhindern das Zählen.
              </p>
            </>
          )}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Eigene Events und Einstellungen</summary>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
          <p>Eigene Ereignisse, z. B. ein abgeschicktes Kontaktformular:</p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs text-foreground">
            {'window.novaAnalytics.track("contact_form_submitted", { form_name: "kontakt" });'}
          </pre>
          <p>
            Automatisch erfasst: Seitenaufrufe (auch in Single-Page-Apps), Herkunft und UTM-Parameter, aktive Verweildauer,
            Klicks auf externe Links, Downloads sowie Telefon- und E-Mail-Links (ohne Nummer oder Adresse). Optional mit{" "}
            <code className="font-mono text-xs">data-auto=&quot;forms,scroll&quot;</code>: abgeschickte Formulare (nur Name,
            nie Inhalte) und Scrolltiefe.
          </p>
          <p>
            Datenschutz: keine Cookies, keine IP-Speicherung; „Global Privacy Control“ und „Do Not Track“ werden respektiert.
          </p>
        </div>
      </details>

      {testUrl && (
        <p className="text-sm text-muted-foreground">
          Diese Website ist die NOVA-Adresse selbst. Zum Ausprobieren:{" "}
          <Link href={testUrl} className="font-medium text-brand underline-offset-4 hover:underline" target="_blank">
            Testseite öffnen
          </Link>
          .
        </p>
      )}
    </div>
  );
}
