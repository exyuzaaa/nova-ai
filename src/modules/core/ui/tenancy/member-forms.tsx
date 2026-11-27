"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/app/copy-button";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import { invitableRoles, ROLE_LABELS, type MemberRole } from "../../domain/roles";
import type { ActionState } from "../../server/action-state";
import { inviteMemberAction } from "../../server/actions/tenant-actions";

const IDLE: ActionState = { status: "idle" };

export function InviteMemberForm({ tenantId, actorRole }: { tenantId: string; actorRole: MemberRole }) {
  const [state, formAction, isPending] = useActionState(inviteMemberAction, IDLE);
  const roles = invitableRoles(actorRole);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="flex-1">
          <FormField
            label="E-Mail-Adresse"
            name="email"
            type="email"
            autoComplete="off"
            required
            error={state.fieldErrors?.email}
          />
        </div>
        <NativeSelect label="Rolle" name="role" defaultValue="viewer" className="sm:w-44" error={state.fieldErrors?.role}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" disabled={isPending} className="sm:mt-[22px]">
          {isPending ? "Wird erstellt …" : "Einladen"}
        </Button>
      </form>
      <FormMessage status={state.status} message={state.message} />
      {state.invitationLink && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="invitation-link">
            {state.invitationLink}
          </code>
          <CopyButton value={state.invitationLink} label="Link kopieren" />
        </div>
      )}
    </div>
  );
}
