import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { utcToLocalDateTime } from "@/modules/core/domain/time-zone";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { formatMoney, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/modules/crm/domain/crm";
import { findDuplicates, listActivities } from "@/modules/crm/server/customers";
import { getLead } from "@/modules/crm/server/leads";
import { ActivityFeed } from "@/modules/crm/ui/activity-feed";
import { ActivityForm } from "@/modules/crm/ui/customer-parts";
import { ConvertLeadForm, DeleteLeadButton, LeadForm } from "@/modules/crm/ui/lead-forms";

export const metadata: Metadata = { title: "Lead" };

const amountInput = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function LeadDetail({ params }: Pick<PageProps<"/app/[tenant]/crm/leads/[leadId]">, "params">) {
  const { tenant: slug, leadId } = await params;
  const { tenant, permissions, user } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  if (!uuidSchema.safeParse(leadId).success) notFound();
  const lead = await getLead(tenant.id, leadId);
  if (!lead) notFound();

  const canEdit = permissions.has("crm.edit");
  const converted = lead.status === "converted";
  const [activities, members, suggestions] = await Promise.all([
    listActivities(tenant.id, { leadId: lead.id }),
    listMembers(tenant.id),
    canEdit && !converted
      ? findDuplicates(tenant.id, lead.companyName ?? lead.contactName ?? lead.title, lead.email)
      : Promise.resolve([]),
  ]);
  const base = tenantBasePath(tenant.slug);
  const memberOptions = members.map((member) => ({ id: member.memberId, label: member.email }));
  const memberNames = new Map(memberOptions.map((member) => [member.id, member.label]));
  const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tenant.timezone });

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{lead.number}</p>
          <h1 className="text-xl font-semibold tracking-tight">{lead.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={converted ? "default" : "outline"} className="h-5 text-[11px]">
              {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
            </Badge>
            <span>Quelle: {LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS] ?? lead.source}</span>
            <span>· Bewertung {lead.score}/100</span>
            {lead.estimatedValue !== null && <span>· {formatMoney(lead.estimatedValue)}</span>}
            {lead.ownerMemberId && <span>· zuständig: {memberNames.get(lead.ownerMemberId) ?? "–"}</span>}
          </p>
          <p className="mt-1 text-sm">
            {[lead.companyName, lead.contactName, lead.email, lead.phone].filter(Boolean).join(" · ")}
          </p>
          {lead.followUpAt && !converted && (
            <p className={cn("mt-1 text-sm", lead.followUpDue ? "font-medium text-negative" : "text-muted-foreground")}>
              Wiedervorlage {dateTime.format(new Date(lead.followUpAt))}
              {lead.followUpDue && " – fällig"}
            </p>
          )}
        </div>
        {permissions.has("crm.manage") && <DeleteLeadButton tenantId={tenant.id} leadId={lead.id} title={lead.title} />}
      </header>

      {converted && lead.convertedCustomerId && (
        <p role="status" className="rounded-xl border border-positive/30 bg-positive/5 px-4 py-3 text-sm">
          Dieser Lead wurde am {dateTime.format(new Date(lead.convertedAt ?? lead.createdAt))} in einen Kunden umgewandelt.{" "}
          <Link href={`${base}/crm/kunden/${lead.convertedCustomerId}`} className="font-medium text-brand hover:underline">
            Zum Kunden
          </Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Section title="Verlauf und Aufgaben">
            {canEdit && (
              <details className="rounded-lg border p-3" open={activities.length === 0 && !converted}>
                <summary className="cursor-pointer text-sm font-medium">Neuer Eintrag</summary>
                <div className="mt-3">
                  <ActivityForm tenantId={tenant.id} target={{ leadId: lead.id }} members={memberOptions} />
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
          {canEdit && !converted && (
            <Section title="Lead bearbeiten">
              <LeadForm
                tenantId={tenant.id}
                members={memberOptions}
                values={{
                  id: lead.id,
                  title: lead.title,
                  companyName: lead.companyName,
                  contactName: lead.contactName,
                  email: lead.email,
                  phone: lead.phone,
                  source: lead.source,
                  status: lead.status,
                  score: lead.score,
                  estimatedValue: lead.estimatedValue === null ? "" : amountInput.format(lead.estimatedValue),
                  ownerMemberId: lead.ownerMemberId,
                  followUpLocal: lead.followUpAt ? utcToLocalDateTime(lead.followUpAt, tenant.timezone) : "",
                  notes: lead.notes,
                }}
              />
            </Section>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {canEdit && !converted && (
            <Section
              title="In Kunden umwandeln"
              description="Legt einen Kunden mit Hauptansprechpartner an oder ordnet den Lead einem bestehenden Kunden zu. Der Verlauf wandert mit."
            >
              <ConvertLeadForm
                tenantId={tenant.id}
                leadId={lead.id}
                hasEstimatedValue={lead.estimatedValue !== null}
                suggestions={suggestions.map((candidate) => ({ id: candidate.id, label: `${candidate.number} · ${candidate.name}` }))}
              />
            </Section>
          )}
          {lead.notes && (
            <Section title="Notizen">
              <p className="text-sm whitespace-pre-line">{lead.notes}</p>
            </Section>
          )}
          <p className="text-xs text-muted-foreground">
            Erfasst am {dateTime.format(new Date(lead.createdAt))} ·{" "}
            <Link href={`${base}/crm/leads`} className="hover:underline">
              Zur Leadliste
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default function LeadPage({ params }: PageProps<"/app/[tenant]/crm/leads/[leadId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Lead wird geladen" />}>
      <LeadDetail params={params} />
    </Suspense>
  );
}
