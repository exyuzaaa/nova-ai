import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { countOpportunitiesByPipeline, listPipelines } from "@/modules/crm/server/opportunities";
import { CreatePipelineForm, PipelineSettings } from "@/modules/crm/ui/pipeline-settings";

export const metadata: Metadata = { title: "Einstellungen" };

async function SettingsContent({ params }: Pick<PageProps<"/app/[tenant]/crm/einstellungen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "crm.manage");
  const pipelines = await listPipelines(tenant.id);
  const counts = await countOpportunitiesByPipeline(
    tenant.id,
    pipelines.map((pipeline) => pipeline.id),
  );
  return (
    <>
      <PageHeader title="CRM-Einstellungen" description="Pipelines und Phasen für Verkaufschancen." />
      {pipelines.map((pipeline) => (
        <Section key={pipeline.id} title={`Pipeline: ${pipeline.name}`}>
          <PipelineSettings
            tenantId={tenant.id}
            pipeline={{
              id: pipeline.id,
              name: pipeline.name,
              isDefault: pipeline.isDefault,
              opportunityCount: counts.get(pipeline.id) ?? 0,
              stages: pipeline.stages.map(({ id, name, probability, kind }) => ({
                id,
                name,
                probability,
                kind,
              })),
            }}
          />
        </Section>
      ))}
      <Section title="Weitere Pipeline" description="Zum Beispiel für Service-Verträge oder einen zweiten Vertriebsweg.">
        <CreatePipelineForm tenantId={tenant.id} />
      </Section>
    </>
  );
}

export default function SettingsPage({ params }: PageProps<"/app/[tenant]/crm/einstellungen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Einstellungen werden geladen" />}>
      <SettingsContent params={params} />
    </Suspense>
  );
}
