import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import {
  formatMoney,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  PAGE_SIZE,
  parseLeadListQuery,
  type LeadListQuery,
} from "@/modules/crm/domain/crm";
import { listLeads } from "@/modules/crm/server/leads";

export const metadata: Metadata = { title: "Leads" };

const SORT_LABELS = { follow_up_at: "Wiedervorlage", created_at: "Neueste zuerst", score: "Beste Bewertung", title: "Titel" } as const;

const queryString = (query: LeadListQuery, page: number) => {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "open") params.set("status", query.status);
  if (query.source) params.set("quelle", query.source);
  if (query.owner) params.set("zustaendig", query.owner);
  if (query.sort !== "follow_up_at") params.set("sortierung", query.sort);
  if (page > 1) params.set("seite", String(page));
  const value = params.toString();
  return value ? `?${value}` : "";
};

async function LeadList({ params, searchParams }: Pick<PageProps<"/app/[tenant]/crm/leads">, "params" | "searchParams">) {
  const [{ tenant: slug }, rawQuery] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  const query = parseLeadListQuery(rawQuery);
  const [{ rows, total }, members] = await Promise.all([listLeads(tenant.id, query), listMembers(tenant.id)]);
  const base = `${tenantBasePath(tenant.slug)}/crm/leads`;
  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tenant.timezone });
  const filtered = Boolean(query.q || query.source || query.owner || query.status !== "open");

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} ${total === 1 ? "Lead" : "Leads"}${query.status === "open" ? " offen" : ""}`}
        actions={
          <>
            {permissions.has("crm.export") && (
              <Button asChild size="sm" variant="outline">
                <a href={`${tenantBasePath(tenant.slug)}/crm/export?typ=leads`} download>
                  <Download className="size-4" aria-hidden />
                  CSV-Export
                </a>
              </Button>
            )}
            {permissions.has("crm.edit") && (
              <Button asChild size="sm">
                <Link href={`${base}/neu`}>
                  <Plus className="size-4" aria-hidden />
                  Neuer Lead
                </Link>
              </Button>
            )}
          </>
        }
      />

      <form method="get" action={base} role="search" aria-label="Leads filtern" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="lead-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="Titel, Firma, Person, E-Mail"
            maxLength={100}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <NativeSelect label="Status" name="status" defaultValue={query.status}>
          <option value="open">Offen</option>
          <option value="all">Alle</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Quelle" name="quelle" defaultValue={query.source ?? ""}>
          <option value="">Alle</option>
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {LEAD_SOURCE_LABELS[source]}
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
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm" variant="outline">
            Anwenden
          </Button>
          {filtered && (
            <Link href={base} className="text-sm text-muted-foreground hover:underline">
              Filter zurücksetzen
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={filtered ? "Keine Leads gefunden" : "Keine offenen Leads"}>
          {filtered ? "Passe die Suche oder die Filter an." : "Erfasse Anfragen, Empfehlungen und Kontakte aus Veranstaltungen als Lead."}
        </EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">
              Leads, Seite {query.page} von {pages}
            </caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="w-24 px-4 py-2 text-left font-medium">Nummer</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Lead</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Status</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Bewertung</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Wert</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Wiedervorlage</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Zuständig</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.number}</td>
                  <th scope="row" className="px-4 py-2 text-left font-medium">
                    <Link href={`${base}/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {[row.companyName, row.contactName, LEAD_SOURCE_LABELS[row.source as keyof typeof LEAD_SOURCE_LABELS]]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </th>
                  <td className="px-4 py-2">
                    <Badge variant={row.status === "qualified" ? "default" : "outline"} className="h-5 text-[11px]">
                      {LEAD_STATUS_LABELS[row.status as keyof typeof LEAD_STATUS_LABELS] ?? row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.score}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.estimatedValue === null ? "–" : formatMoney(row.estimatedValue)}</td>
                  <td className={cn("px-4 py-2", row.followUpDue ? "font-medium text-negative" : "text-muted-foreground")}>
                    {row.followUpAt ? dateTime.format(new Date(row.followUpAt)) : "–"}
                    {row.followUpDue && <span className="sr-only"> (fällig)</span>}
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
            <Link href={`${base}${queryString(query, query.page - 1)}`} className="font-medium text-brand hover:underline">
              Vorherige Seite
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Seite {query.page} von {pages}
          </span>
          {query.page < pages ? (
            <Link href={`${base}${queryString(query, query.page + 1)}`} className="font-medium text-brand hover:underline">
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

export default function LeadsPage({ params, searchParams }: PageProps<"/app/[tenant]/crm/leads">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Leads werden geladen" />}>
      <LeadList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
