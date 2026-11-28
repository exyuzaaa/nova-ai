import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { listCustomerOptions } from "@/modules/projects/server/projects";
import { listTimeProjectOptions } from "@/modules/projects/server/time";
import { NewDocumentForm } from "@/modules/finance/ui/finance-forms";

export const metadata: Metadata = { title: "Neuer Beleg" };

async function NewDocument({ params, searchParams }: Pick<PageProps<"/app/[tenant]/finanzen/neu">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "finance.edit");
  const kind = query.art === "angebot" ? "quote" : "invoice";
  const customerId = typeof query.kunde === "string" && uuidSchema.safeParse(query.kunde).success ? query.kunde : undefined;
  const [customers, projects] = await Promise.all([
    permissions.has("crm.view") ? listCustomerOptions(tenant.id) : Promise.resolve([]),
    permissions.has("projects.view") ? listTimeProjectOptions(tenant.id).catch(() => []) : Promise.resolve([]),
  ]);
  const base = tenantBasePath(tenant.slug);
  return (
    <>
      <PageHeader
        title={kind === "quote" ? "Neues Angebot" : "Neue Rechnung"}
        description="Der Beleg startet als Entwurf. Die Nummer wird erst beim Ausstellen vergeben."
      />
      <Section title="Grunddaten">
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Für einen Beleg brauchst du einen Kunden im CRM.{" "}
            {permissions.has("crm.edit") && (
              <Link href={`${base}/crm/kunden/neu`} className="font-medium text-foreground underline">
                Kunden anlegen
              </Link>
            )}
          </p>
        ) : (
          <NewDocumentForm tenantId={tenant.id} kind={kind} customers={customers} projects={projects} defaultCustomerId={customerId} />
        )}
      </Section>
    </>
  );
}

export default function NewDocumentPage({ params, searchParams }: PageProps<"/app/[tenant]/finanzen/neu">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
      <NewDocument params={params} searchParams={searchParams} />
    </Suspense>
  );
}
