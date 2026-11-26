"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/modules/auth/ui/form-field";
import { assignableRoles, hasRole, ROLE_LABELS, type MemberRole } from "../../domain/roles";
import { changeMemberRoleAction, removeMemberAction, type ActionState } from "../../server/actions/tenancy-actions";
import type { Member } from "../../server/organizations";
import { NativeSelect } from "./native-select";

const IDLE: ActionState = { status: "idle" };

function MemberRow({
  member,
  organizationId,
  actorRole,
}: {
  member: Member;
  organizationId: string;
  actorRole: MemberRole;
}) {
  const [roleState, roleAction, roleSaving] = useActionState(changeMemberRoleAction, IDLE);
  const [removeState, removeAction, removing] = useActionState(removeMemberAction, IDLE);

  const isAdmin = hasRole(actorRole, "admin");
  const canManage = isAdmin && !member.isSelf && (member.role !== "owner" || actorRole === "owner");
  const roles = assignableRoles(actorRole);
  const message = roleState.message ?? removeState.message;
  const status = roleState.status !== "idle" ? roleState.status : removeState.status;

  return (
    <tr className="border-b last:border-0 align-top">
      <th scope="row" className="py-3 pr-3 text-left font-normal">
        <span className="block truncate">{member.email}</span>
        {member.isSelf && <span className="text-xs text-muted-foreground">Du</span>}
        {message && (
          <div className="mt-2">
            <FormMessage status={status} message={message} />
          </div>
        )}
      </th>
      <td className="py-3 pr-3">
        {canManage ? (
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="memberId" value={member.memberId} />
            <NativeSelect label={`Rolle von ${member.email}`} hideLabel name="role" defaultValue={member.role} className="w-40">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline" size="sm" disabled={roleSaving} aria-label={`Rolle von ${member.email} speichern`}>
              Speichern
            </Button>
          </form>
        ) : (
          <span className="text-sm">{ROLE_LABELS[member.role]}</span>
        )}
      </td>
      <td className="py-3 text-right">
        {(canManage || member.isSelf) && (
          <form
            action={removeAction}
            onSubmit={(event) => {
              const question = member.isSelf
                ? "Möchtest du die Organisation wirklich verlassen?"
                : `${member.email} wirklich aus der Organisation entfernen?`;
              if (!window.confirm(question)) event.preventDefault();
            }}
          >
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="memberId" value={member.memberId} />
            <Button type="submit" variant="ghost" size="sm" disabled={removing} className="text-negative hover:text-negative">
              {member.isSelf ? "Verlassen" : "Entfernen"}
            </Button>
          </form>
        )}
      </td>
    </tr>
  );
}

export function MembersTable({
  members,
  organizationId,
  actorRole,
}: {
  members: Member[];
  organizationId: string;
  actorRole: MemberRole;
}) {
  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">Mitglieder der Organisation</caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="pb-2 text-left font-medium">E-Mail-Adresse</th>
          <th scope="col" className="w-64 pb-2 text-left font-medium">Rolle</th>
          <th scope="col" className="w-28 pb-2 text-right font-medium">
            <span className="sr-only">Aktionen</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <MemberRow key={member.memberId} member={member} organizationId={organizationId} actorRole={actorRole} />
        ))}
      </tbody>
    </table>
  );
}
