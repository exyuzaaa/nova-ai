import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { PROJECT_STATUS_LABELS, VISIBILITY_LABELS } from "@/modules/projects/domain/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { listCustomerOptions, listProjectMembers, listStatuses } from "@/modules/projects/server/projects";
import { ProjectDangerZone, ProjectForm, ProjectMembers, StatusSettings } from "@/modules/projects/ui/project-forms";

export const metadata: Metadata = { title: "Einstellungen" };

async function Settings({ params }: Pick<PageProps<"/app/[tenant]/projekte/[projectId]/einstellungen">, "params">) {
  const { tenant: slug, projectId } = await params;
  const { tenant, project, members, memberNames, permissions } = await loadProjectContext(decodeURIComponent(slug), projectId);
  const [projectMembers, statuses, customers] = await Promise.all([
    listProjectMembers(tenant.id, project.id),
    listStatuses(tenant.id, project.id),
    project.canManage && permissions.has("crm.view") ? listCustomerOptions(tenant.id) : Promise.resolve(null),
  ]);
  const inProject = new Set(projectMembers.map((row) => row.memberId));
  const memberOptions = members.map((member) => ({ id: member.memberId, label: member.email }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-4">
        {project.canManage ? (
          <Section title="Projektdaten">
            <ProjectForm
              tenantId={tenant.id}
              members={memberOptions}
              customers={customers}
              values={{
                id: project.id,
                name: project.name,
                description: project.description,
                customerId: project.customerId,
                status: project.status,
                visibility: project.visibility,
                color: project.color,
                startDate: project.startDate,
                dueDate: project.dueDate,
                budgetHours: project.budgetHours,
                leadMemberId: project.leadMemberId,
              }}
            />
          </Section>
        ) : (
          <Section title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>{PROJECT_STATUS_LABELS[project.status]}</dd>
              <dt className="text-muted-foreground">Sichtbar für</dt>
              <dd>{VISIBILITY_LABELS[project.visibility]}</dd>
              {project.budgetHours !== null && (
                <>
                  <dt className="text-muted-foreground">Budget</dt>
                  <dd>{String(project.budgetHours).replace(".", ",")} Stunden</dd>
                </>
              )}
            </dl>
            {project.description && <p className="text-sm whitespace-pre-line">{project.description}</p>}
          </Section>
        )}
        {project.canManage && (
          <Section title="Status und Board-Spalten" description="„Erledigt“-Status schließen Aufgaben ab. Status mit Aufgaben lassen sich erst nach dem Verschieben löschen.">
            <StatusSettings tenantId={tenant.id} projectId={project.id} statuses={statuses} />
          </Section>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Section
          title="Projektteam"
          description={project.visibility === "members" ? "Nur diese Personen (und Administratoren) sehen das Projekt." : "Alle im Unternehmen sehen das Projekt; das Team sind die festen Beteiligten."}
        >
          <ProjectMembers
            tenantId={tenant.id}
            projectId={project.id}
            canManage={project.canManage}
            rows={projectMembers.map((row) => ({ id: row.id, role: row.role, label: memberNames.get(row.memberId) ?? "Ehemaliges Mitglied" }))}
            candidates={memberOptions.filter((option) => !inProject.has(option.id))}
          />
        </Section>
        {project.canManage && (
          <Section title="Archivieren oder löschen" description="Archivierte Projekte bleiben lesbar, lassen sich aber nicht mehr ändern.">
            <ProjectDangerZone
              tenantId={tenant.id}
              projectId={project.id}
              name={project.name}
              archived={Boolean(project.archivedAt)}
              canDelete={permissions.has("projects.manage")}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

export default function ProjectSettingsPage({ params }: PageProps<"/app/[tenant]/projekte/[projectId]/einstellungen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Einstellungen werden geladen" />}>
      <Settings params={params} />
    </Suspense>
  );
}
