import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, ROLE_LABELS } from "@/modules/analytics/domain/roles";
import { revokeInvitationAction } from "@/modules/analytics/server/actions/tenancy-actions";
import { getOrganization, listMembers, listPendingInvitations } from "@/modules/analytics/server/organizations";
import { getSite } from "@/modules/analytics/server/sites";
import { getTrackingStatus } from "@/modules/analytics/server/tracking-status";
import { TrackingInstallation } from "@/modules/analytics/ui/tenancy/tracking-installation";
import { getAppOrigin } from "@/lib/app-origin";
import { CopyButton } from "@/modules/analytics/ui/components/copy-button";
import { MembersTable } from "@/modules/analytics/ui/tenancy/members-table";
import {
  InviteMemberForm,
  OrganizationSettingsForm,
  WebsiteSettingsForm,
} from "@/modules/analytics/ui/tenancy/settings-forms";

export const metadata: Metadata = { title: "Einstellungen" };

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });

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

  const organization = await getOrganization(site.organizationId);
  if (!organization) notFound();
  const isAdmin = hasRole(organization.role, "admin");
  const [members, invitations, status, origin] = await Promise.all([
    listMembers(organization.id),
    listPendingInvitations(organization),
    getTrackingStatus(site.id),
    getAppOrigin(),
  ]);
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

      <Section title="Organisation" description={`Deine Rolle: ${ROLE_LABELS[organization.role]}`}>
        <OrganizationSettingsForm organization={{ id: organization.id, name: organization.name }} canEdit={isAdmin} />
      </Section>

      <Section title="Mitglieder" description="Alle Mitglieder haben Zugriff auf die Websites dieser Organisation.">
        {/* relative: hält absolut positionierte Screenreader-Texte im Scroll-Container */}
        <div className="relative overflow-x-auto">
          <div className="min-w-[560px]">
            <MembersTable members={members} organizationId={organization.id} actorRole={organization.role} />
          </div>
        </div>
      </Section>

      {isAdmin && (
        <Section
          title="Mitglieder einladen"
          description="Die eingeladene Person meldet sich mit genau dieser E-Mail-Adresse an und nimmt die Einladung über den Link an."
        >
          <InviteMemberForm organizationId={organization.id} actorRole={organization.role} />
          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Offene Einladungen</h3>
              <ul className="flex flex-col divide-y rounded-lg border">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
                    <span className="text-muted-foreground">{ROLE_LABELS[invitation.role]}</span>
                    <span className="text-xs text-muted-foreground">
                      gültig bis {dateFormat.format(new Date(invitation.expiresAt))}
                    </span>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Einladung für ${invitation.email} widerrufen`}>
                        Widerrufen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

export default function SettingsPage({ params }: PageProps<"/analytics/[siteId]/settings">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">Website, Organisation und Team</p>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Einstellungen werden geladen">
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
