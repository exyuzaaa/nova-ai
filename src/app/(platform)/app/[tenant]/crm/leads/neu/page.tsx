import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { EMPTY_LEAD, LeadForm } from "@/modules/crm/ui/lead-forms";

export const metadata: Metadata = { title: "Neuer Lead" };

async function NewLead({ params }: Pick<PageProps<"/app/[tenant]/crm/leads/neu">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "crm.edit");
  const members = await listMembers(tenant.id);
  return (
    <Section title="Lead erfassen" description="Die Lead-Nummer vergibt NOVA automatisch.">
      <LeadForm tenantId={tenant.id} values={EMPTY_LEAD} members={members.map((member) => ({ id: member.memberId, label: member.email }))} />
    </Section>
  );
}

export default function NewLeadPage({ params }: PageProps<"/app/[tenant]/crm/leads/neu">) {
  return (
    <>
      <PageHeader title="Neuer Lead" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
        <NewLead params={params} />
      </Suspense>
    </>
  );
}
