import { Suspense } from "react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { getMailAccount, getSettings } from "@/modules/finance/server/finance";
import { isGmailConfigured } from "@/modules/finance/server/gmail";
import { SettingsForm } from "@/modules/finance/ui/finance-forms";
import { DisconnectGmailButton } from "@/modules/finance/ui/mail-forms";

export const metadata: Metadata = { title: "Einstellungen" };

const GMAIL_RESULTS: Record<string, { tone: "ok" | "error"; text: string }> = {
  verbunden: { tone: "ok", text: "Gmail ist verbunden. Belege können jetzt per E-Mail versendet werden." },
  abgebrochen: { tone: "error", text: "Die Verbindung wurde bei Google abgebrochen. Es wurde nichts geändert." },
  abgelaufen: { tone: "error", text: "Der Verbindungsversuch ist abgelaufen. Bitte erneut auf „Mit Gmail verbinden“ klicken." },
  rechte: { tone: "error", text: "Bitte erlaube NOVA bei Google, E-Mails in deinem Namen zu senden (Häkchen setzen) und verbinde erneut." },
  config: { tone: "error", text: "Der Gmail-Versand ist auf dieser NOVA-Installation noch nicht eingerichtet." },
  fehler: { tone: "error", text: "Die Verbindung mit Gmail ist fehlgeschlagen. Bitte später erneut versuchen." },
};

const formatDateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));

async function Settings({ params, searchParams }: Pick<PageProps<"/app/[tenant]/finanzen/einstellungen">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "finance.manage");
  const [settings, account] = await Promise.all([getSettings(tenant.id), getMailAccount(tenant.id)]);
  const configured = isGmailConfigured();
  const result = typeof query.gmail === "string" ? GMAIL_RESULTS[query.gmail] : undefined;
  const connectHref = `${tenantBasePath(tenant.slug)}/finanzen/gmail/verbinden`;
  return (
    <>
      <PageHeader title="Rechnungsdaten" description="Diese Angaben erscheinen auf jedem Beleg. Ausgestellte Belege behalten die Daten zum Zeitpunkt der Ausstellung." />
      <Section title="Firma, Steuer und Bank">
        <SettingsForm tenantId={tenant.id} values={settings} />
      </Section>
      <Section title="E-Mail-Versand (Gmail)" description="Belege werden aus eurem eigenen Gmail- oder Google-Workspace-Postfach versendet und liegen dort unter „Gesendet“.">
        {result && (
          <p role="status" className={result.tone === "ok" ? "rounded-lg border border-positive/40 bg-positive/10 px-3 py-2 text-sm" : "rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm"}>
            {result.text}
          </p>
        )}
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            Noch nicht verfügbar: Für diese NOVA-Installation ist noch kein Google-Zugang hinterlegt (Betreiber der Plattform).
          </p>
        ) : account ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Verbunden mit <span className="font-medium">{account.email}</span> seit {formatDateTime(account.connectedAt, tenant.timezone)}
              {account.lastUsedAt && <> · zuletzt genutzt {formatDateTime(account.lastUsedAt, tenant.timezone)}</>}
            </p>
            {account.lastError && (
              <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2" role="alert">
                Letzter Versand fehlgeschlagen: {account.lastError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={connectHref}>Anderes Konto verbinden</a>
              </Button>
              <DisconnectGmailButton tenantId={tenant.id} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Du wirst zu Google weitergeleitet und bestätigst dort, dass NOVA E-Mails in eurem Namen senden darf. NOVA erhält
              keinen Lesezugriff auf das Postfach und speichert kein Passwort.
            </p>
            <div>
              <Button asChild size="sm">
                <a href={connectHref}>Mit Gmail verbinden</a>
              </Button>
            </div>
          </div>
        )}
      </Section>
      <p className="text-xs text-muted-foreground">
        Nummernkreise: AN- (Angebote), RE- (Rechnungen), GS- (Gutschriften), je Jahr fortlaufend und lückenlos ab 0001. Die
        Pflichtangaben nach § 14 UStG prüft NOVA beim Ausstellen; die steuerliche Richtigkeit verantwortest du bzw. deine Steuerberatung.
      </p>
    </>
  );
}

export default function SettingsPage({ params, searchParams }: PageProps<"/app/[tenant]/finanzen/einstellungen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Einstellungen werden geladen" />}>
      <Settings params={params} searchParams={searchParams} />
    </Suspense>
  );
}
