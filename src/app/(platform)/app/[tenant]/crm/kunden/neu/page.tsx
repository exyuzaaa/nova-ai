import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { CustomerForm, EMPTY_CUSTOMER } from "@/modules/crm/ui/customer-form";

export const metadata: Metadata = { title: "Neuer Kunde" };

async function NewCustomer({ params }: Pick<PageProps<"/app/[tenant]/crm/kunden/neu">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "crm.edit");
  const members = await listMembers(tenant.id);
  return (
    <Section title="Stammdaten" description="Die Kundennummer vergibt NOVA automatisch.">
      <CustomerForm
        tenantId={tenant.id}
        base={tenantBasePath(tenant.slug)}
        values={EMPTY_CUSTOMER}
        members={members.map((member) => ({ id: member.memberId, label: member.email }))}
      />
    </Section>
  );
}

export default function NewCustomerPage({ params }: PageProps<"/app/[tenant]/crm/kunden/neu">) {
  return (
    <>
      <PageHeader title="Neuer Kunde" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
        <NewCustomer params={params} />
      </Suspense>
    </>
  );
}
