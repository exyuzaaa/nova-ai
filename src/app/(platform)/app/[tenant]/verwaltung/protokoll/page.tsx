import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { listAuditLog } from "@/modules/core/server/admin-data";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { describeAuditEntry } from "@/modules/core/ui/admin/audit-labels";

export const metadata: Metadata = { title: "Protokoll" };

const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "medium" });

async function AuditLog({ params, searchParams }: Pick<PageProps<"/app/[tenant]/verwaltung/protokoll">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "core.audit.read");
  const requested = Number.parseInt(typeof query.seite === "string" ? query.seite : "1", 10);
  const page = Number.isFinite(requested) && requested > 0 && requested <= 10_000 ? requested : 1;
  const [{ entries, hasMore }, members] = await Promise.all([listAuditLog(tenant.id, page), listMembers(tenant.id)]);
  const emailByUser = new Map(members.map((member) => [member.userId, member.email]));
  const base = `${tenantBasePath(tenant.slug)}/verwaltung/protokoll`;

  return (
    <Section title="Änderungen" description="Unveränderliches Protokoll aller sicherheitsrelevanten Änderungen, neueste zuerst.">
      {entries.length === 0 ? (
        <EmptyState title="Keine Einträge" />
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Protokoll, Seite {page}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="w-48 pb-2 text-left font-medium">Zeitpunkt</th>
                <th scope="col" className="pb-2 text-left font-medium">Änderung</th>
                <th scope="col" className="w-56 pb-2 text-left font-medium">Durch</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    <time dateTime={entry.createdAt}>{dateTime.format(new Date(entry.createdAt))}</time>
                  </td>
                  <td className="py-2 pr-3">{describeAuditEntry(entry)}</td>
                  <td className="truncate py-2 text-muted-foreground">
                    {entry.actorType === "system"
                      ? "System"
                      : (entry.actorId && emailByUser.get(entry.actorId)) ?? "Ehemaliges Mitglied"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(page > 1 || hasMore) && (
        <nav aria-label="Seiten" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`${base}?seite=${page - 1}`} className="font-medium text-brand hover:underline">
              Neuere Einträge
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">Seite {page}</span>
          {hasMore ? (
            <Link href={`${base}?seite=${page + 1}`} className="font-medium text-brand hover:underline">
              Ältere Einträge
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </Section>
  );
}

export default function AuditPage({ params, searchParams }: PageProps<"/app/[tenant]/verwaltung/protokoll">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <PageHeader title="Protokoll" description="Wer hat wann was geändert" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Protokoll wird geladen" />}>
        <AuditLog params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
