import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { MODULE_NAVIGATION, tenantBasePath } from "@/modules/core/config/navigation";
import { ROLE_LABELS } from "@/modules/core/domain/roles";
import { getTenantProfile, listAuditLog, listOrganization } from "@/modules/core/server/admin-data";
import { loadTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { describeAuditEntry } from "@/modules/core/ui/admin/audit-labels";

export const metadata: Metadata = { title: "Übersicht" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      {content}
    </Link>
  ) : (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">{content}</div>
  );
}

async function Overview({ params }: Pick<PageProps<"/app/[tenant]">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions, modules, user } = await loadTenantContext(decodeURIComponent(slug));
  if (tenant.suspended) return null;

  const base = tenantBasePath(tenant.slug);
  const canSeeMembers = permissions.has("core.members.read");
  const canSeeOrganization = permissions.has("core.departments.read");
  const canSeeAudit = permissions.has("core.audit.read");
  const [members, organization, audit, profile] = await Promise.all([
    canSeeMembers ? listMembers(tenant.id) : Promise.resolve([]),
    canSeeOrganization ? listOrganization(tenant.id) : Promise.resolve({ departments: [], teams: [] }),
    canSeeAudit ? listAuditLog(tenant.id, 1) : Promise.resolve({ entries: [], hasMore: false }),
    getTenantProfile(tenant.id),
  ]);

  const usableModules = modules.filter((module) => module.enabled && !module.isCore);
  const missingProfile =
    permissions.has("core.settings.manage") && profile && (!profile.street || !profile.city || !profile.legalName);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={tenant.name} description={`Angemeldet als ${user.email} · ${ROLE_LABELS[tenant.role]}`} />

      {missingProfile && (
        <Link
          href={`${base}/verwaltung`}
          className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm hover:bg-brand/10"
        >
          <span className="flex-1">
            Vervollständige das Unternehmensprofil (Firmierung und Anschrift) – es wird später für Rechnungen und
            Angebote benötigt.
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {canSeeMembers && <Stat label="Mitglieder" value={members.length} href={`${base}/verwaltung/mitglieder`} />}
        {canSeeOrganization && (
          <Stat label="Abteilungen" value={organization.departments.length} href={`${base}/verwaltung/abteilungen`} />
        )}
        {canSeeOrganization && <Stat label="Teams" value={organization.teams.length} href={`${base}/verwaltung/abteilungen`} />}
      </div>

      <Section title="Deine Module" description="Module, die für dein Unternehmen freigeschaltet sind.">
        {usableModules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Für dein Unternehmen ist noch kein Modul freigeschaltet.
            {permissions.has("core.modules.manage") && (
              <>
                {" "}
                <Link href={`${base}/verwaltung/module`} className="font-medium text-brand underline-offset-4 hover:underline">
                  Module verwalten
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {usableModules.map((module) => {
              const nav = MODULE_NAVIGATION[module.key as keyof typeof MODULE_NAVIGATION];
              const href =
                nav?.segment && (!nav.permission || permissions.has(nav.permission)) ? `${base}/${nav.segment}` : null;
              return (
                <li key={module.key} className="flex flex-col gap-1 rounded-lg border p-4">
                  <span className="text-sm font-medium">{module.name}</span>
                  <span className="text-sm text-muted-foreground">{module.description}</span>
                  {href && (
                    <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                      {module.name} öffnen <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {canSeeAudit && (
        <Section title="Letzte Änderungen">
          {audit.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Änderungen protokolliert.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {audit.entries.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                  <span>{describeAuditEntry(entry)}</span>
                  <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(entry.createdAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <Link href={`${base}/verwaltung/protokoll`} className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Gesamtes Protokoll
          </Link>
        </Section>
      )}
    </div>
  );
}

export default function TenantOverviewPage({ params }: PageProps<"/app/[tenant]">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Übersicht wird geladen">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        }
      >
        <Overview params={params} />
      </Suspense>
    </div>
  );
}
