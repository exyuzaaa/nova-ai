import { Suspense } from "react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { hasRole, ROLE_DESCRIPTIONS, ROLE_LABELS, MEMBER_ROLES } from "@/modules/core/domain/roles";
import { listCustomRoles } from "@/modules/core/server/admin-data";
import { revokeInvitationAction } from "@/modules/core/server/actions/tenant-actions";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers, listPendingInvitations } from "@/modules/core/server/tenants";
import { MemberRolesForm } from "@/modules/core/ui/admin/role-forms";
import { InviteMemberForm } from "@/modules/core/ui/tenancy/member-forms";
import { MembersTable } from "@/modules/core/ui/tenancy/members-table";

export const metadata: Metadata = { title: "Mitglieder" };

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });

async function Members({ params }: Pick<PageProps<"/app/[tenant]/verwaltung/mitglieder">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "core.members.read");
  const isAdmin = hasRole(tenant.role, "admin");
  const canManageRoles = permissions.has("core.roles.manage");
  const [members, invitations, roles] = await Promise.all([
    listMembers(tenant.id),
    listPendingInvitations(tenant),
    listCustomRoles(tenant.id),
  ]);

  return (
    <>
      <Section title="Mitglieder" description={`${members.length} ${members.length === 1 ? "Person" : "Personen"} · deine Rolle: ${ROLE_LABELS[tenant.role]}`}>
        <div className="relative overflow-x-auto">
          <div className="min-w-[560px]">
            <MembersTable members={members} tenantId={tenant.id} actorRole={tenant.role} />
          </div>
        </div>
      </Section>

      {isAdmin && (
        <Section
          title="Mitglieder einladen"
          description="Die eingeladene Person meldet sich mit genau dieser E-Mail-Adresse an und nimmt die Einladung über den Link an."
        >
          <InviteMemberForm tenantId={tenant.id} actorRole={tenant.role} />
          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Offene Einladungen</h3>
              <ul className="flex flex-col divide-y rounded-lg border">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{invitation.email}</span>
                    <span className="text-muted-foreground">{ROLE_LABELS[invitation.role]}</span>
                    <span className="text-xs text-muted-foreground">gültig bis {dateFormat.format(new Date(invitation.expiresAt))}</span>
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Einladung für ${invitation.email} widerrufen`}>
                        Widerrufen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {roles.length > 0 && (
        <Section
          title="Zusätzliche Rollen"
          description="Eigene Rollen geben einzelnen Mitgliedern zusätzliche Rechte zur Basisrolle."
        >
          <ul className="flex flex-col divide-y">
            {members.map((member) => {
              const assigned = roles.filter((role) => role.memberIds.includes(member.memberId));
              return (
                <li key={member.memberId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-6">
                  <span className="w-56 shrink-0 truncate text-sm">{member.email}</span>
                  {canManageRoles ? (
                    <MemberRolesForm
                      tenantId={tenant.id}
                      memberId={member.memberId}
                      memberLabel={member.email}
                      roles={roles.map(({ id, name }) => ({ id, name }))}
                      assigned={assigned.map((role) => role.id)}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {assigned.length > 0 ? assigned.map((role) => role.name).join(", ") : "Keine"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Basisrollen">
        <dl className="grid gap-3 sm:grid-cols-2">
          {MEMBER_ROLES.map((role) => (
            <div key={role} className="rounded-lg border p-3">
              <dt className="text-sm font-medium">{ROLE_LABELS[role]}</dt>
              <dd className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

export default function MembersPage({ params }: PageProps<"/app/[tenant]/verwaltung/mitglieder">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Mitglieder" description="Team, Einladungen und Rollen" />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Mitglieder werden geladen">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        }
      >
        <Members params={params} />
      </Suspense>
    </div>
  );
}
