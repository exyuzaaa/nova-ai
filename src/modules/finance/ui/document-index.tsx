import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { todayIn } from "@/modules/projects/domain/projects";
import { KIND_PLURAL, STATUS_LABELS, type DocumentKind } from "../domain/finance";
import { listDocuments } from "../server/finance";
import { DocumentList } from "./document-list";

const STATUS_FILTERS: Record<DocumentKind, string[]> = {
  invoice: ["draft", "issued", "partially_paid", "paid", "cancelled"],
  quote: ["draft", "sent", "accepted", "rejected"],
  credit_note: [],
};
const NEW_PARAM: Partial<Record<DocumentKind, string>> = { invoice: "rechnung", quote: "angebot" };

/** Belegliste je Art mit Suche und Statusfilter (Rechnungen, Angebote, Gutschriften). */
export async function DocumentIndex({ slug, kind, query }: { slug: string; kind: DocumentKind; query: Record<string, string | string[] | undefined> }) {
  const { tenant, permissions } = await requireTenantContext(slug, "finance.view");
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const status = typeof query.status === "string" && (query.status === "open" || STATUS_FILTERS[kind].includes(query.status)) ? query.status : "";
  const rows = await listDocuments(tenant.id, { kind, q, status: status || undefined });
  const base = `${tenantBasePath(tenant.slug)}/finanzen`;
  const newParam = NEW_PARAM[kind];
  return (
    <>
      <PageHeader
        title={KIND_PLURAL[kind]}
        description={`${rows.length} ${rows.length === 1 ? "Beleg" : "Belege"}`}
        actions={
          newParam &&
          permissions.has("finance.edit") && (
            <Button asChild size="sm">
              <Link href={`${base}/neu?art=${newParam}`}>
                <Plus className="size-4" aria-hidden />
                {kind === "invoice" ? "Neue Rechnung" : "Neues Angebot"}
              </Link>
            </Button>
          )
        }
      />
      <form className="flex flex-wrap items-end gap-2" role="search" aria-label={`${KIND_PLURAL[kind]} filtern`}>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="finance-search" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="finance-search"
            name="q"
            defaultValue={q}
            placeholder="Nummer, Empfänger oder Betreff"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        {STATUS_FILTERS[kind].length > 0 && (
          <NativeSelect label="Status" name="status" defaultValue={status}>
            <option value="">Alle</option>
            {kind === "invoice" && <option value="open">Offen (unbezahlt)</option>}
            {STATUS_FILTERS[kind].map((entry) => (
              <option key={entry} value={entry}>
                {STATUS_LABELS[entry as keyof typeof STATUS_LABELS]}
              </option>
            ))}
          </NativeSelect>
        )}
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={q || status ? "Nichts gefunden" : `Noch keine ${KIND_PLURAL[kind]}`}>
          {kind === "credit_note" && !q && "Gutschriften entstehen automatisch, wenn du eine Rechnung stornierst."}
        </EmptyState>
      ) : (
        <DocumentList rows={rows} base={base} today={todayIn(tenant.timezone)} />
      )}
    </>
  );
}
