import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { CUSTOMER_STATUS_LABELS, CUSTOMER_STATUSES, PAGE_SIZE, parseCustomerListQuery, type CustomerListQuery } from "@/modules/crm/domain/crm";
import { listCustomers } from "@/modules/crm/server/customers";

export const metadata: Metadata = { title: "Kunden" };

const SORT_LABELS = { name: "Name", number: "Kundennummer", created_at: "Neueste zuerst", updated_at: "Zuletzt geändert" } as const;

const queryString = (query: CustomerListQuery, overrides: Partial<CustomerListQuery>) => {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status) params.set("status", merged.status);
  if (merged.owner) params.set("zustaendig", merged.owner);
  if (merged.archived) params.set("archiv", "1");
  if (merged.sort !== "name") params.set("sortierung", merged.sort);
  if (merged.descending) params.set("richtung", "ab");
  if (merged.page > 1) params.set("seite", String(merged.page));
  const value = params.toString();
  return value ? `?${value}` : "";
};

async function CustomerList({ params, searchParams }: Pick<PageProps<"/app/[tenant]/crm/kunden">, "params" | "searchParams">) {
  const [{ tenant: slug }, rawQuery] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  const query = parseCustomerListQuery(rawQuery);
  const [{ rows, total }, members] = await Promise.all([listCustomers(tenant.id, query), listMembers(tenant.id)]);
  const base = `${tenantBasePath(tenant.slug)}/crm/kunden`;
  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(query.q || query.status || query.owner);

  return (
    <>
      <PageHeader
        title={query.archived ? "Archivierte Kunden" : "Kunden"}
        description={`${total} ${total === 1 ? "Kunde" : "Kunden"}${filtered ? " gefunden" : ""}`}
        actions={
          permissions.has("crm.edit") && (
            <Button asChild size="sm">
              <Link href={`${base}/neu`}>
                <Plus className="size-4" aria-hidden />
                Neuer Kunde
              </Link>
            </Button>
          )
        }
      />

      <form method="get" action={base} role="search" aria-label="Kunden filtern" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor="customer-q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="customer-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Name, Nummer, E-Mail, Ort"
            maxLength={100}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <NativeSelect label="Status" name="status" defaultValue={query.status ?? ""}>
          <option value="">Alle</option>
          {CUSTOMER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CUSTOMER_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Zuständig" name="zustaendig" defaultValue={query.owner ?? ""}>
          <option value="">Alle</option>
          {members.map((member) => (
            <option key={member.memberId} value={member.memberId}>
              {member.email}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Sortierung" name="sortierung" defaultValue={query.sort}>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        {query.archived && <input type="hidden" name="archiv" value="1" />}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm" variant="outline">
            Anwenden
          </Button>
          {filtered && (
            <Link href={`${base}${query.archived ? "?archiv=1" : ""}`} className="text-sm text-muted-foreground hover:underline">
              Filter zurücksetzen
            </Link>
          )}
          <span className="flex-1" />
          <Link href={query.archived ? base : `${base}?archiv=1`} className="text-sm text-muted-foreground hover:underline">
            {query.archived ? "Aktive Kunden anzeigen" : "Archiv anzeigen"}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? "Keine Kunden gefunden" : query.archived ? "Keine archivierten Kunden" : "Noch keine Kunden"}>
          {filtered ? "Passe die Suche oder die Filter an." : permissions.has("crm.edit") && !query.archived ? "Lege deinen ersten Kunden an." : null}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">
              Kunden, Seite {query.page} von {pages}
            </caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="w-28 px-4 py-2 text-left font-medium">Nummer</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Name</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Kontakt</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Ort</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Status</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Zuständig</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.number}</td>
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link href={`${base}/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                    {row.tags.length > 0 && <span className="block text-xs font-normal text-muted-foreground">{row.tags.join(", ")}</span>}
                  </th>
                  <td className="px-4 py-2 text-muted-foreground">{row.email ?? row.phone ?? "–"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.city ?? "–"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={row.status === "active" ? "default" : "outline"} className="h-5 text-[11px]">
                      {CUSTOMER_STATUS_LABELS[row.status as keyof typeof CUSTOMER_STATUS_LABELS] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{row.ownerMemberId ? (memberNames.get(row.ownerMemberId) ?? "–") : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Seiten" className="flex items-center justify-between text-sm">
          {query.page > 1 ? (
            <Link href={`${base}${queryString(query, { page: query.page - 1 })}`} className="font-medium text-brand hover:underline">
              Vorherige Seite
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Seite {query.page} von {pages}
          </span>
          {query.page < pages ? (
            <Link href={`${base}${queryString(query, { page: query.page + 1 })}`} className="font-medium text-brand hover:underline">
              Nächste Seite
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export default function CustomersPage({ params, searchParams }: PageProps<"/app/[tenant]/crm/kunden">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Kunden werden geladen" />}>
      <CustomerList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
