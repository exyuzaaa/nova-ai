import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { formatEuro, isOverdue } from "@/modules/finance/domain/finance";
import { getOverview, getSettings, listDocuments } from "@/modules/finance/server/finance";
import { DocumentList } from "@/modules/finance/ui/document-list";
import { todayIn } from "@/modules/projects/domain/projects";

export const metadata: Metadata = { title: "Übersicht" };

function Card({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "negative" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={tone === "negative" ? "text-xl font-semibold text-negative tabular-nums" : "text-xl font-semibold tabular-nums"}>{value}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

async function Overview({ params }: Pick<PageProps<"/app/[tenant]/finanzen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "finance.view");
  const today = todayIn(tenant.timezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const [overview, open, drafts, settings] = await Promise.all([
    getOverview(tenant.id, monthStart),
    listDocuments(tenant.id, { kind: "invoice", status: "open" }),
    listDocuments(tenant.id, { status: "draft" }),
    getSettings(tenant.id),
  ]);
  const base = `${tenantBasePath(tenant.slug)}/finanzen`;
  const overdue = open.filter((row) => isOverdue(row, today));
  const settingsMissing = !settings?.legal_name || !settings?.street || !settings?.city || (!settings?.tax_number && !settings?.vat_id);
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  return (
    <>
      <PageHeader
        title="Finanzen"
        description="Angebote, Rechnungen und Zahlungseingänge"
        actions={
          permissions.has("finance.edit") && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/neu?art=angebot`}>
                  <Plus className="size-4" aria-hidden />
                  Angebot
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`${base}/neu?art=rechnung`}>
                  <Plus className="size-4" aria-hidden />
                  Rechnung
                </Link>
              </Button>
            </div>
          )
        }
      />
      {settingsMissing && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="note">
          Bevor du Rechnungen ausstellen kannst, brauchen wir Firmenname, Anschrift und Steuernummer oder USt-IdNr.
          {permissions.has("finance.manage") ? (
            <>
              {" "}
              <Link href={`${base}/einstellungen`} className="font-medium underline">
                Rechnungsdaten eintragen
              </Link>
            </>
          ) : (
            " Bitte wende dich an eine Person mit Verwaltungsrechten."
          )}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Offene Rechnungen" value={formatEuro(overview.openTotal)} detail={plural(overview.openCount, "Rechnung", "Rechnungen")} />
        <Card label="Überfällig" value={formatEuro(overview.overdueTotal)} detail={plural(overview.overdueCount, "Rechnung", "Rechnungen")} tone={overview.overdueCount > 0 ? "negative" : undefined} />
        <Card label="Zahlungseingang diesen Monat" value={formatEuro(overview.paidMonth)} detail={`Ausgestellt: ${formatEuro(overview.issuedMonth)}`} />
        <Card label="Offene Angebote" value={formatEuro(overview.quotesOpenTotal)} detail={plural(overview.quotesOpen, "Angebot", "Angebote")} />
      </div>
      {overdue.length > 0 && (
        <Section title="Überfällige Rechnungen">
          <DocumentList rows={overdue} base={base} today={today} />
        </Section>
      )}
      <Section title="Offene Rechnungen" description={open.length === 0 ? "Alle ausgestellten Rechnungen sind bezahlt." : undefined}>
        {open.length > 0 && <DocumentList rows={open.slice(0, 20)} base={base} today={today} />}
      </Section>
      {drafts.length > 0 && (
        <Section title="Entwürfe" description="Noch nicht ausgestellt, ohne Nummer.">
          <DocumentList rows={drafts} base={base} today={today} showKind />
        </Section>
      )}
    </>
  );
}

export default function FinancePage({ params }: PageProps<"/app/[tenant]/finanzen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Übersicht wird geladen" />}>
      <Overview params={params} />
    </Suspense>
  );
}
