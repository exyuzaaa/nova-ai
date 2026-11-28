import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { getSettings } from "@/modules/finance/server/finance";
import { SettingsForm } from "@/modules/finance/ui/finance-forms";

export const metadata: Metadata = { title: "Einstellungen" };

async function Settings({ params }: Pick<PageProps<"/app/[tenant]/finanzen/einstellungen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "finance.manage");
  const settings = await getSettings(tenant.id);
  return (
    <>
      <PageHeader title="Rechnungsdaten" description="Diese Angaben erscheinen auf jedem Beleg. Ausgestellte Belege behalten die Daten zum Zeitpunkt der Ausstellung." />
      <Section title="Firma, Steuer und Bank">
        <SettingsForm tenantId={tenant.id} values={settings} />
      </Section>
      <p className="text-xs text-muted-foreground">
        Nummernkreise: AN- (Angebote), RE- (Rechnungen), GS- (Gutschriften), je Jahr fortlaufend und lückenlos ab 0001. Die
        Pflichtangaben nach § 14 UStG prüft NOVA beim Ausstellen; die steuerliche Richtigkeit verantwortest du bzw. deine Steuerberatung.
      </p>
    </>
  );
}

export default function SettingsPage({ params }: PageProps<"/app/[tenant]/finanzen/einstellungen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Einstellungen werden geladen" />}>
      <Settings params={params} />
    </Suspense>
  );
}
