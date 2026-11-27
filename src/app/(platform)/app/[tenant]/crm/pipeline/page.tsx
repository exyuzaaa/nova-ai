import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { formatMoney } from "@/modules/crm/domain/crm";
import { getBoard, listPipelines } from "@/modules/crm/server/opportunities";
import { MoveStageForm } from "@/modules/crm/ui/opportunity-forms";

export const metadata: Metadata = { title: "Pipeline" };

const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

async function Board({ params, searchParams }: Pick<PageProps<"/app/[tenant]/crm/pipeline">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  const pipelines = await listPipelines(tenant.id);
  const wanted = typeof query.pipeline === "string" && uuidSchema.safeParse(query.pipeline).success ? query.pipeline : null;
  const pipeline = pipelines.find((entry) => entry.id === wanted) ?? pipelines.find((entry) => entry.isDefault) ?? pipelines[0];
  const base = `${tenantBasePath(tenant.slug)}/crm`;

  if (!pipeline) {
    return <EmptyState title="Keine Pipeline vorhanden">Eine Administratorin oder ein Administrator kann eine Pipeline anlegen.</EmptyState>;
  }

  const [columns, members] = await Promise.all([getBoard(tenant.id, pipeline), listMembers(tenant.id)]);
  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  const open = columns.filter((column) => column.kind === "open");
  const openTotal = open.reduce((sum, column) => sum + column.summary.total, 0);
  const weighted = open.reduce((sum, column) => sum + column.summary.weighted, 0);
  const canEdit = permissions.has("crm.edit");
  const stageOptions = pipeline.stages.map(({ id, name, probability, kind }) => ({ id, name, probability, kind }));

  return (
    <>
      <PageHeader
        title={pipelines.length > 1 ? `Pipeline: ${pipeline.name}` : "Pipeline"}
        description={`Offen ${formatMoney(openTotal)} · gewichtet ${formatMoney(weighted)}`}
      />
      {pipelines.length > 1 && (
        <nav aria-label="Pipelines" className="flex flex-wrap gap-2 text-sm">
          {pipelines.map((entry) => (
            <Link
              key={entry.id}
              href={`${base}/pipeline?pipeline=${entry.id}`}
              aria-current={entry.id === pipeline.id ? "page" : undefined}
              className={cn("rounded-md border px-3 py-1", entry.id === pipeline.id ? "border-brand font-medium" : "text-muted-foreground hover:bg-muted/40")}
            >
              {entry.name}
            </Link>
          ))}
        </nav>
      )}
      <p className="text-sm text-muted-foreground">
        Neue Verkaufschancen legst du beim jeweiligen{" "}
        <Link href={`${base}/kunden`} className="font-medium text-brand hover:underline">
          Kunden
        </Link>{" "}
        an. Gewonnene und verlorene Chancen werden 90 Tage lang angezeigt.
      </p>

      {/* relative: hält absolut positionierte Screenreader-Texte im Scroll-Container */}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-3" aria-label="Phasen">
          {columns.map((column) => (
            <li key={column.id} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/20 p-3" aria-label={`Phase ${column.name}`}>
              <header className="flex flex-col">
                <h2 className="flex items-center justify-between text-sm font-medium">
                  <span>{column.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{column.summary.count}</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(column.summary.total)}
                  {column.kind === "open" && ` · ${column.probability} % · gewichtet ${formatMoney(column.summary.weighted)}`}
                </p>
              </header>
              <ul className="flex flex-col gap-2">
                {column.cards.length === 0 && <li className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Keine Chancen</li>}
                {column.cards.map((card) => (
                  <li key={card.id} className="flex flex-col gap-1.5 rounded-lg border bg-card p-3">
                    <Link href={`${base}/verkaufschancen/${card.id}`} className="text-sm font-medium hover:underline">
                      {card.title}
                    </Link>
                    <Link href={`${base}/kunden/${card.customerId}`} className="text-xs text-muted-foreground hover:underline">
                      {card.customerName}
                    </Link>
                    <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                      <span className="font-medium tabular-nums">{formatMoney(card.amount, card.currency)}</span>
                      <span className="text-muted-foreground">
                        {card.expectedCloseDate ? `bis ${date.format(new Date(`${card.expectedCloseDate}T00:00:00Z`))}` : card.number}
                      </span>
                    </p>
                    {card.ownerMemberId && <p className="truncate text-xs text-muted-foreground">{memberNames.get(card.ownerMemberId)}</p>}
                    {canEdit && (
                      <MoveStageForm tenantId={tenant.id} opportunityId={card.id} title={card.title} currentStageId={column.id} stages={stageOptions} />
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

export default function PipelinePage({ params, searchParams }: PageProps<"/app/[tenant]/crm/pipeline">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Pipeline wird geladen" />}>
      <Board params={params} searchParams={searchParams} />
    </Suspense>
  );
}
