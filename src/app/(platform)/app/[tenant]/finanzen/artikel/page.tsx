import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { formatEuro } from "@/modules/finance/domain/finance";
import { listArticles } from "@/modules/finance/server/finance";
import { ArchiveArticleButton, ArticleForm } from "@/modules/finance/ui/finance-forms";

export const metadata: Metadata = { title: "Artikel" };

async function Articles({ params }: Pick<PageProps<"/app/[tenant]/finanzen/artikel">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "finance.view");
  const articles = await listArticles(tenant.id, true);
  const canEdit = permissions.has("finance.edit");
  const active = articles.filter((article) => !article.archived);
  const archived = articles.filter((article) => article.archived);
  return (
    <>
      <PageHeader title="Artikel und Leistungen" description="Vorlagen für Positionen. Spätere Preisänderungen ändern keine bestehenden Belege." />
      {canEdit && (
        <Section title="Neuer Artikel">
          <ArticleForm tenantId={tenant.id} />
        </Section>
      )}
      {active.length === 0 ? (
        <EmptyState title="Noch keine Artikel">{canEdit && "Lege wiederkehrende Leistungen an, um sie schneller in Belege zu übernehmen."}</EmptyState>
      ) : (
        <Section title={`Aktiv (${active.length})`}>
          <ul className="flex flex-col divide-y">
            {active.map((article) => (
              <li key={article.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                {canEdit ? (
                  <>
                    <ArticleForm tenantId={tenant.id} values={article} />
                    <div>
                      <ArchiveArticleButton tenantId={tenant.id} articleId={article.id} archived={false} />
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between gap-4 text-sm">
                    <span>{article.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatEuro(article.unitPrice)} / {article.unit} · {article.taxRate} %
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {archived.length > 0 && (
        <Section title={`Ausgeblendet (${archived.length})`}>
          <ul className="flex flex-col divide-y">
            {archived.map((article) => (
              <li key={article.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-muted-foreground">
                  {article.name} · {formatEuro(article.unitPrice)} / {article.unit}
                </span>
                {canEdit && <ArchiveArticleButton tenantId={tenant.id} articleId={article.id} archived />}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

export default function ArticlesPage({ params }: PageProps<"/app/[tenant]/finanzen/artikel">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Artikel werden geladen" />}>
      <Articles params={params} />
    </Suspense>
  );
}
