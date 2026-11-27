import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { CustomerImportWizard } from "@/modules/crm/ui/import-wizard";

export const metadata: Metadata = { title: "Import" };

async function ImportContent({ params }: Pick<PageProps<"/app/[tenant]/crm/import">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "crm.manage");
  return (
    <>
      <PageHeader title="Kunden importieren" description="Kunden aus einer CSV-Datei übernehmen, z. B. aus Excel oder einem anderen CRM." />
      <Section
        title="CSV-Import"
        description="Vor dem Import werden alle Zeilen geprüft. Es wird erst gespeichert, wenn du auf „importieren“ klickst."
      >
        <CustomerImportWizard tenantId={tenant.id} customersHref={`${tenantBasePath(tenant.slug)}/crm/kunden`} />
      </Section>
    </>
  );
}

export default function ImportPage({ params }: PageProps<"/app/[tenant]/crm/import">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Import wird geladen" />}>
      <ImportContent params={params} />
    </Suspense>
  );
}
