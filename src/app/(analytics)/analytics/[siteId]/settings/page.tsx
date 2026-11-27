import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, ROLE_LABELS } from "@/modules/core/domain/roles";
import { getTenant } from "@/modules/core/server/tenants";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { getSite } from "@/modules/analytics/server/sites";
import { getTrackingStatus } from "@/modules/analytics/server/tracking-status";
import { TrackingInstallation } from "@/modules/analytics/ui/tenancy/tracking-installation";
import { getAppOrigin } from "@/lib/app-origin";
import { CopyButton } from "@/components/app/copy-button";
import { WebsiteSettingsForm } from "@/modules/analytics/ui/tenancy/settings-forms";

export const metadata: Metadata = { title: "Einstellungen" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5" aria-label={title}>
      <header>
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

async function SettingsContent({ params }: Pick<PageProps<"/analytics/[siteId]/settings">, "params">) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();

  if (site.isDemo) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Die Demo-Website hat keine Einstellungen. Lege eine eigene Website an, um Tracking und Team zu verwalten.
      </p>
    );
  }

  const tenant = await getTenant(site.organizationId);
  if (!tenant) notFound();
  const isAdmin = hasRole(tenant.role, "admin");
  const [status, origin] = await Promise.all([getTrackingStatus(site.id), getAppOrigin()]);
  const snippet = `<script defer src="${origin}/tracker.js" data-site-id="${site.publicSiteId}"></script>`;
  const appHost = new URL(origin).hostname.replace(/^www\./, "");
  const testUrl = site.domain === appHost ? `/tracking-test?site=${site.publicSiteId}` : null;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Website" description={isAdmin ? undefined : "Nur Administratoren können diese Angaben ändern."}>
        <WebsiteSettingsForm
          site={{ id: site.id, name: site.name, domain: site.domain, timezone: site.timezone }}
          canEdit={isAdmin}
        />
      </Section>

      <Section
        title="Tracking-ID"
        description="Öffentliche Kennung dieser Website für das Tracking-Skript. Sie ist kein Geheimnis und gewährt keinen Zugriff auf Daten."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm" data-testid="public-site-id">
            {site.publicSiteId}
          </code>
          {site.publicSiteId && <CopyButton value={site.publicSiteId} label="ID kopieren" />}
        </div>
      </Section>

      <Section title="Tracking einbauen" description="Ein Skript, keine Cookies, unter 2 KB.">
        <TrackingInstallation snippet={snippet} status={status} testUrl={testUrl} now={new Date()} />
      </Section>

      <Section
        title="Team und Unternehmen"
        description={`Mitglieder, Einladungen und Rollen verwaltest du zentral in NOVA. Deine Rolle: ${ROLE_LABELS[tenant.role]}`}
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${tenantBasePath(tenant.slug)}/verwaltung/mitglieder`}>Mitglieder verwalten</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`${tenantBasePath(tenant.slug)}/verwaltung`}>Unternehmensprofil</Link>
          </Button>
        </div>
      </Section>
    </div>
  );
}

export default function SettingsPage({ params }: PageProps<"/analytics/[siteId]/settings">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Website, Unternehmen und Team</p>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Einstellungen werden geladen">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        }
      >
        <SettingsContent params={params} />
      </Suspense>
    </div>
  );
}
