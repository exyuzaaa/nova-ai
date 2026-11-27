"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import { invitableRoles, ROLE_LABELS, type MemberRole } from "@/modules/core/domain/roles";
import { COMMON_TIME_ZONES } from "../../domain/tenancy-validation";
import { inviteMemberAction, updateTenantAction } from "@/modules/core/server/actions/tenant-actions";
import type { ActionState } from "@/modules/core/server/action-state";
import { updateWebsiteAction } from "../../server/actions/website-actions";
import { CopyButton } from "../components/copy-button";
import { NativeSelect } from "./native-select";

const IDLE: ActionState = { status: "idle" };

export function WebsiteSettingsForm({
  site,
  canEdit,
}: {
  site: { id: string; name: string; domain: string; timezone: string };
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateWebsiteAction, IDLE);
  const zones = COMMON_TIME_ZONES.includes(site.timezone as (typeof COMMON_TIME_ZONES)[number])
    ? COMMON_TIME_ZONES
    : [site.timezone, ...COMMON_TIME_ZONES];

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <input type="hidden" name="siteId" value={site.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" name="name" defaultValue={site.name} required disabled={!canEdit} error={state.fieldErrors?.name} />
        <FormField
          label="Domain"
          name="domain"
          defaultValue={site.domain}
          required
          disabled={!canEdit}
          autoCapitalize="none"
          spellCheck={false}
          error={state.fieldErrors?.domain}
        />
        <NativeSelect label="Zeitzone" name="timezone" defaultValue={site.timezone} disabled={!canEdit} error={state.fieldErrors?.timezone}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </NativeSelect>
      </div>
      {canEdit && (
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert …" : "Website speichern"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function TenantSettingsForm({
  tenant,
  canEdit,
}: {
  tenant: { id: string; name: string };
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateTenantAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenant.id} />
      <FormMessage status={state.status} message={state.message} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <FormField
            label="Name des Unternehmens"
            name="name"
            defaultValue={tenant.name}
            required
            disabled={!canEdit}
            error={state.fieldErrors?.name}
          />
        </div>
        {canEdit && (
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Wird gespeichert …" : "Speichern"}
          </Button>
        )}
      </div>
    </form>
  );
}

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
