import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { formatMoney, weightedAmount } from "@/modules/crm/domain/crm";
import { listActivities } from "@/modules/crm/server/customers";
import { getOpportunity, listPipelines } from "@/modules/crm/server/opportunities";
import { ActivityFeed } from "@/modules/crm/ui/activity-feed";
import { ActivityForm } from "@/modules/crm/ui/customer-parts";
import { DeleteOpportunityButton, OpportunityForm } from "@/modules/crm/ui/opportunity-forms";

export const metadata: Metadata = { title: "Verkaufschance" };

const amountInput = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

async function OpportunityDetail({ params }: Pick<PageProps<"/app/[tenant]/crm/verkaufschancen/[opportunityId]">, "params">) {
  const { tenant: slug, opportunityId } = await params;
  const { tenant, permissions, user } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  if (!uuidSchema.safeParse(opportunityId).success) notFound();
  const opportunity = await getOpportunity(tenant.id, opportunityId);
  if (!opportunity) notFound();

  const [pipelines, activities, members] = await Promise.all([
    listPipelines(tenant.id),
    listActivities(tenant.id, { opportunityId: opportunity.id }),
    listMembers(tenant.id),
  ]);
  const pipeline = pipelines.find((entry) => entry.id === opportunity.pipelineId);
  const stage = pipeline?.stages.find((entry) => entry.id === opportunity.stageId);
  const canEdit = permissions.has("crm.edit");
  const base = `${tenantBasePath(tenant.slug)}/crm`;
  const memberOptions = members.map((member) => ({ id: member.memberId, label: member.email }));
  const memberNames = new Map(memberOptions.map((member) => [member.id, member.label]));
  const weighted = stage ? weightedAmount(opportunity.amount, stage, opportunity.probability) : opportunity.amount;

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{opportunity.number}</p>
          <h1 className="text-xl font-semibold tracking-tight">{opportunity.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {stage && (
              <Badge variant={stage.kind === "open" ? "outline" : "default"} className="h-5 text-[11px]">
                {stage.name}
              </Badge>
            )}
            <Link href={`${base}/kunden/${opportunity.customerId}`} className="font-medium text-brand hover:underline">
              {opportunity.customerName}
            </Link>
            {opportunity.ownerMemberId && <span>· zuständig: {memberNames.get(opportunity.ownerMemberId) ?? "–"}</span>}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-medium tabular-nums">{formatMoney(opportunity.amount, opportunity.currency)}</span>
            {stage?.kind === "open" && (
              <span className="text-muted-foreground">
                {" "}
                · {opportunity.probability ?? stage.probability} % · gewichtet {formatMoney(weighted, opportunity.currency)}
              </span>
            )}
            {opportunity.expectedCloseDate && (
              <span className="text-muted-foreground"> · erwarteter Abschluss {date.format(new Date(`${opportunity.expectedCloseDate}T00:00:00Z`))}</span>
            )}
          </p>
          {stage?.kind === "lost" && opportunity.lostReason && <p className="mt-1 text-sm text-muted-foreground">Grund: {opportunity.lostReason}</p>}
        </div>
        {permissions.has("crm.manage") && <DeleteOpportunityButton tenantId={tenant.id} opportunityId={opportunity.id} title={opportunity.title} />}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Verlauf und Aufgaben" description="Einträge erscheinen auch beim Kunden.">
          {canEdit && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">Neuer Eintrag</summary>
              <div className="mt-3">
                <ActivityForm tenantId={tenant.id} target={{ opportunityId: opportunity.id, customerId: opportunity.customerId }} members={memberOptions} />
              </div>
            </details>
          )}
          <ActivityFeed
            tenantId={tenant.id}
            activities={activities}
            memberNames={memberNames}
            currentUserId={user.id}
            canEdit={canEdit}
            canManage={permissions.has("crm.manage")}
            timeZone={tenant.timezone}
          />
        </Section>
        {canEdit && pipeline ? (
          <Section title="Bearbeiten">
            <OpportunityForm
              tenantId={tenant.id}
              members={memberOptions}
              stages={pipeline.stages.map(({ id, name, probability, kind }) => ({ id, name, probability, kind }))}
              values={{
                id: opportunity.id,
                customerId: opportunity.customerId,
                pipelineId: opportunity.pipelineId,
                title: opportunity.title,
                amount: amountInput.format(opportunity.amount),
                stageId: opportunity.stageId,
                probability: opportunity.probability,
                expectedCloseDate: opportunity.expectedCloseDate,
                ownerMemberId: opportunity.ownerMemberId,
                lostReason: opportunity.lostReason,
                notes: opportunity.notes,
              }}
            />
          </Section>
        ) : (
          opportunity.notes && (
            <Section title="Notizen">
              <p className="text-sm whitespace-pre-line">{opportunity.notes}</p>
            </Section>
          )
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href={`${base}/pipeline?pipeline=${opportunity.pipelineId}`} className="hover:underline">
          Zur Pipeline
        </Link>
        {opportunity.leadId && (
          <>
            {" · "}
            <Link href={`${base}/leads/${opportunity.leadId}`} className="hover:underline">
              Ursprünglicher Lead
            </Link>
          </>
        )}
      </p>
    </>
  );
}

export default function OpportunityPage({ params }: PageProps<"/app/[tenant]/crm/verkaufschancen/[opportunityId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Verkaufschance wird geladen" />}>
      <OpportunityDetail params={params} />
    </Suspense>
  );
}
