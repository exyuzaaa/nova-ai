import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { listOrganization, type Department } from "@/modules/core/server/admin-data";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { DeleteUnitButton, DepartmentForm, TeamForm, TeamMembersForm } from "@/modules/core/ui/admin/organization-forms";

export const metadata: Metadata = { title: "Abteilungen und Teams" };

/** Abteilungen als Baum (Tiefensuche), für eingerückte Darstellung. */
const flattenTree = (departments: Department[]): { department: Department; depth: number }[] => {
  const children = new Map<string | null, Department[]>();
  for (const department of departments) {
    const parent = departments.some((entry) => entry.id === department.parentId) ? department.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), department]);
  }
  const result: { department: Department; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const department of children.get(parentId) ?? []) {
      result.push({ department, depth });
      visit(department.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
};

async function Organization({ params }: Pick<PageProps<"/app/[tenant]/verwaltung/abteilungen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "core.departments.read");
  const canManage = permissions.has("core.departments.manage");
  const [{ departments, teams }, members] = await Promise.all([
    listOrganization(tenant.id),
    permissions.has("core.members.read") ? listMembers(tenant.id) : Promise.resolve([]),
  ]);

  const memberOptions = members.map((member) => ({ id: member.memberId, label: member.email }));
  const memberName = new Map(memberOptions.map((member) => [member.id, member.label]));
  const tree = flattenTree(departments);
  const departmentOptions = tree.map(({ department, depth }) => ({ id: department.id, label: `${"– ".repeat(depth)}${department.name}` }));
  const departmentName = new Map(departments.map((department) => [department.id, department.name]));

  return (
    <>
      <Section title="Abteilungen" description="Struktur deines Unternehmens. Abteilungen können verschachtelt werden.">
        {tree.length === 0 ? (
          <EmptyState title="Noch keine Abteilungen">Lege z. B. Vertrieb, Verwaltung oder Technik an.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {tree.map(({ department, depth }) => (
              <li key={department.id} className="px-3 py-3" style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                {canManage ? (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{department.name}</span>
                      {department.leadMemberId && (
                        <span className="text-muted-foreground"> · Leitung: {memberName.get(department.leadMemberId)}</span>
                      )}
                    </summary>
                    <div className="mt-3 flex flex-col gap-2">
                      <DepartmentForm tenantId={tenant.id} departments={departmentOptions} members={memberOptions} department={department} />
                      <DeleteUnitButton tenantId={tenant.id} kind="department" id={department.id} name={department.name} />
                    </div>
                  </details>
                ) : (
                  <p className="text-sm">
                    <span className="font-medium">{department.name}</span>
                    {department.leadMemberId && <span className="text-muted-foreground"> · Leitung: {memberName.get(department.leadMemberId)}</span>}
                  </p>
                )}
                {department.description && <p className="text-xs text-muted-foreground">{department.description}</p>}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="rounded-lg border border-dashed p-4">
            <h3 className="mb-3 text-sm font-medium">Neue Abteilung</h3>
            <DepartmentForm tenantId={tenant.id} departments={departmentOptions} members={memberOptions} />
          </div>
        )}
      </Section>

      <Section title="Teams" description="Teams bündeln Personen über Abteilungen hinweg, z. B. für Projekte oder Kalender.">
        {teams.length === 0 ? (
          <EmptyState title="Noch keine Teams" />
        ) : (
          <ul className="flex flex-col gap-3">
            {teams.map((team) => (
              <li key={team.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{team.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {team.departmentId ? departmentName.get(team.departmentId) : "Ohne Abteilung"} · {team.memberIds.length}{" "}
                    {team.memberIds.length === 1 ? "Mitglied" : "Mitglieder"}
                  </span>
                </div>
                {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
                {canManage ? (
                  <div className="mt-3 flex flex-col gap-4">
                    <TeamMembersForm tenantId={tenant.id} teamId={team.id} teamName={team.name} members={memberOptions} selected={team.memberIds} />
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">Team bearbeiten</summary>
                      <div className="mt-3 flex flex-col gap-2">
                        <TeamForm tenantId={tenant.id} departments={departmentOptions} members={memberOptions} team={team} />
                        <DeleteUnitButton tenantId={tenant.id} kind="team" id={team.id} name={team.name} />
                      </div>
                    </details>
                  </div>
                ) : (
                  team.memberIds.length > 0 && (
                    <p className="mt-2 text-sm">{team.memberIds.map((id) => memberName.get(id) ?? "Mitglied").join(", ")}</p>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="rounded-lg border border-dashed p-4">
            <h3 className="mb-3 text-sm font-medium">Neues Team</h3>
            <TeamForm tenantId={tenant.id} departments={departmentOptions} members={memberOptions} />
          </div>
        )}
      </Section>
    </>
  );
}

export default function OrganizationPage({ params }: PageProps<"/app/[tenant]/verwaltung/abteilungen">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Abteilungen und Teams" description="Organisationsstruktur deines Unternehmens" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Struktur wird geladen" />}>
        <Organization params={params} />
      </Suspense>
    </div>
  );
}
