import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { resolveTenantHref } from "@/modules/core/domain/notifications";
import { searchTenant, SEARCH_MAX_QUERY } from "@/modules/core/server/search";
import { loadTenantContext } from "@/modules/core/server/tenant-context";

export const metadata: Metadata = { title: "Suche" };

const TYPE_LABELS: Record<string, string> = {
  member: "Mitglieder",
  department: "Abteilungen",
  team: "Teams",
  role: "Rollen",
  website: "Websites",
};

async function Results({ params, searchParams }: Pick<PageProps<"/app/[tenant]/suche">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant } = await loadTenantContext(decodeURIComponent(slug));
  const term = (typeof query.q === "string" ? query.q : "").trim().slice(0, SEARCH_MAX_QUERY);
  if (!term) {
    return (
      <EmptyState title="Wonach suchst du?">
        Gib oben einen Begriff ein – gesucht wird in allem, was du in diesem Unternehmen sehen darfst.
      </EmptyState>
    );
  }

  const results = await searchTenant(tenant.id, term);
  const base = tenantBasePath(tenant.slug);
  const groups = new Map<string, typeof results>();
  for (const result of results) groups.set(result.type, [...(groups.get(result.type) ?? []), result]);

  return (
    <>
      <p className="text-sm text-muted-foreground" role="status">
        {results.length === 0 ? `Keine Treffer für „${term}“.` : `${results.length} ${results.length === 1 ? "Treffer" : "Treffer"} für „${term}“`}
      </p>
      {Array.from(groups, ([type, entries]) => (
        <Section key={type} title={TYPE_LABELS[type] ?? type}>
          <ul className="flex flex-col divide-y">
            {entries.map((entry) => {
              const href = resolveTenantHref(base, entry.href);
              return (
                <li key={`${entry.type}-${entry.id}`} className="py-2">
                  {href ? (
                    <Link href={href} className="text-sm font-medium hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{entry.title}</span>
                  )}
                  {entry.subtitle && <p className="text-sm text-muted-foreground">{entry.subtitle}</p>}
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </>
  );
}

export default function SearchPage({ params, searchParams }: PageProps<"/app/[tenant]/suche">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Suche" description="Mitglieder, Abteilungen, Teams, Rollen und Websites – künftig auch Kunden, Projekte und mehr" />
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" role="status" aria-label="Suche läuft" />}>
        <Results params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
