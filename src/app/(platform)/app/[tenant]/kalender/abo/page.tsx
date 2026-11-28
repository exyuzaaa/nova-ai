import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { hasFeedToken } from "@/modules/calendar/server/calendar";
import { FeedSettings } from "@/modules/calendar/ui/event-forms";

export const metadata: Metadata = { title: "Abonnieren" };

async function Feed({ params }: Pick<PageProps<"/app/[tenant]/kalender/abo">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "calendar.view");
  const has = await hasFeedToken(tenant.id);
  return (
    <>
      <PageHeader title="Kalender abonnieren" description="NOVA-Termine in Outlook, Google Kalender oder Apple Kalender anzeigen." />
      <Section
        title="Persönlicher Abo-Link"
        description="Enthält deine Termine, deine Teamtermine, Unternehmenstermine und Einladungen, die du nicht abgesagt hast. Kalender-Apps aktualisieren das Abo meist alle paar Stunden."
      >
        <p className="text-sm">
          {has ? "Für dich besteht ein Abo-Link. Aus Sicherheitsgründen wird er nur beim Erstellen angezeigt." : "Du hast noch keinen Abo-Link."}
        </p>
        <FeedSettings tenantId={tenant.id} hasToken={has} />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">So geht&apos;s:</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Outlook: Kalender hinzufügen → „Aus dem Internet abonnieren“ → Link einfügen.</li>
            <li>Google Kalender: „Weitere Kalender“ → „Per URL“ → Link einfügen.</li>
            <li>Apple Kalender: Ablage → „Neues Kalenderabonnement“ → Link einfügen.</li>
          </ul>
          <p className="mt-2">Wer den Link kennt, sieht diese Termine. Gib ihn nicht weiter; bei Verdacht einfach widerrufen.</p>
        </div>
      </Section>
    </>
  );
}

export default function FeedPage({ params }: PageProps<"/app/[tenant]/kalender/abo">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="Wird geladen" />}>
      <Feed params={params} />
    </Suspense>
  );
}
