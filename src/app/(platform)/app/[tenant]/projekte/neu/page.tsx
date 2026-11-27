import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { listCustomerOptions } from "@/modules/projects/server/projects";
import { ProjectForm } from "@/modules/projects/ui/project-forms";
import { listTemplates } from "@/modules/projects/server/time";
import { CopyProjectForm } from "@/modules/projects/ui/time-forms";

export const metadata: Metadata = { title: "Neues Projekt" };

async function NewProject({ params }: Pick<PageProps<"/app/[tenant]/projekte/neu">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "projects.edit");
  const [members, customers, templates] = await Promise.all([
    listMembers(tenant.id),
    permissions.has("crm.view") ? listCustomerOptions(tenant.id) : Promise.resolve(null),
    listTemplates(tenant.id),
  ]);
  return (
    <>
      <PageHeader title="Neues Projekt" description="Du wirst automatisch Projektleitung und kannst danach Personen einladen." />
      {templates.length > 0 && (
        <Section title="Aus Vorlage" description="Übernimmt Status, Meilensteine, Aufgaben, Checklisten und Abhängigkeiten.">
          <CopyProjectForm
            tenantId={tenant.id}
            asTemplate={false}
            sources={templates.map((template) => ({ id: template.id, label: `${template.name} (${template.taskCount} Aufgaben)` }))}
            submitLabel="Projekt aus Vorlage anlegen"
          />
        </Section>
      )}
      <Section title={templates.length > 0 ? "Leeres Projekt" : "Projektdaten"}>
        <ProjectForm
          tenantId={tenant.id}
          members={members.filter((member) => !member.isSelf).map((member) => ({ id: member.memberId, label: member.email }))}
          customers={customers}
          values={{
            name: "",
            description: null,
            customerId: null,
            status: "active",
            visibility: "tenant",
            color: "#6366f1",
            startDate: null,
            dueDate: null,
            budgetHours: null,
            leadMemberId: null,
          }}
        />
      </Section>
    </>
  );
}

export default function NewProjectPage({ params }: PageProps<"/app/[tenant]/projekte/neu">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
      <NewProject params={params} />
    </Suspense>
  );
}
