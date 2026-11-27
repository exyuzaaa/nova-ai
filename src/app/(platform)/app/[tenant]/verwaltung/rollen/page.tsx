import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { ROLE_LABELS, MEMBER_ROLES } from "@/modules/core/domain/roles";
import { listCustomRoles, listPermissionCatalog } from "@/modules/core/server/admin-data";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { CreateRoleForm, RoleEditor, type GrantablePermission } from "@/modules/core/ui/admin/role-forms";

export const metadata: Metadata = { title: "Rollen und Rechte" };

async function Roles({ params }: Pick<PageProps<"/app/[tenant]/verwaltung/rollen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions, modules } = await requireTenantContext(decodeURIComponent(slug), "core.members.read");
  const [catalog, roles] = await Promise.all([listPermissionCatalog(), listCustomRoles(tenant.id)]);
  const canManage = permissions.has("core.roles.manage");
  const moduleNames = new Map(modules.map((module) => [module.key, module.name]));
  const enabledModules = new Set(modules.filter((module) => module.enabled).map((module) => module.key));
  const permissionNames = new Map(catalog.map((permission) => [permission.key, permission.name]));

  const grantable: GrantablePermission[] = catalog
    .filter((permission) => permission.grantable && enabledModules.has(permission.module))
    .map((permission) => ({
      key: permission.key,
      name: permission.name,
      description: permission.description,
      moduleName: moduleNames.get(permission.module) ?? permission.module,
      // Nur Rechte, die man selbst besitzt, können vergeben werden (die Datenbank prüft das ebenfalls).
      allowed: permissions.has(permission.key),
    }));

  return (
    <>
      <Section
        title="Rechte der Basisrollen"
        description="Jede Person hat eine Basisrolle. Eigene Rollen ergänzen weitere Rechte."
      >
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Rechte je Basisrolle</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="pb-2 text-left font-medium">Recht</th>
                {MEMBER_ROLES.map((role) => (
                  <th key={role} scope="col" className="w-24 pb-2 text-center font-medium">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog
                .filter((permission) => enabledModules.has(permission.module))
                .map((permission) => (
                  <tr key={permission.key} className="border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {permission.name}
                      <span className="block text-xs text-muted-foreground">{moduleNames.get(permission.module)}</span>
                    </th>
                    {MEMBER_ROLES.map((role) => {
                      const granted = MEMBER_ROLES.indexOf(role) >= MEMBER_ROLES.indexOf(permission.defaultRole);
                      return (
                        <td key={role} className="py-2 text-center">
                          <span aria-label={granted ? "ja" : "nein"} className={granted ? "text-positive" : "text-muted-foreground"}>
                            {granted ? "✓" : "–"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Eigene Rollen" description={`${roles.length} ${roles.length === 1 ? "Rolle" : "Rollen"}`}>
        {roles.length === 0 ? (
          <EmptyState title="Noch keine eigenen Rollen">
            Lege eine Rolle an, wenn einzelne Personen mehr dürfen sollen als ihre Basisrolle – etwa Abteilungen verwalten.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {roles.map((role) => (
              <li key={role.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{role.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {role.memberIds.length} {role.memberIds.length === 1 ? "Mitglied" : "Mitglieder"}
                  </span>
                </div>
                {role.description && <p className="mb-3 text-sm text-muted-foreground">{role.description}</p>}
                {canManage ? (
                  <RoleEditor tenantId={tenant.id} role={{ id: role.id, name: role.name, permissions: role.permissions }} permissions={grantable} />
                ) : (
                  <p className="text-sm">
                    {role.permissions.length > 0 ? role.permissions.map((key) => permissionNames.get(key) ?? key).join(", ") : "Keine Rechte"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canManage && (
        <Section title="Neue Rolle" description="Ausgegraute Rechte kannst du nicht vergeben, weil du sie selbst nicht besitzt.">
          <CreateRoleForm tenantId={tenant.id} permissions={grantable} />
        </Section>
      )}
    </>
  );
}

export default function RolesPage({ params }: PageProps<"/app/[tenant]/verwaltung/rollen">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Rollen und Rechte" description="Basisrollen und eigene Rollen mit zusätzlichen Rechten" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Rollen werden geladen" />}>
        <Roles params={params} />
      </Suspense>
    </div>
  );
}
