"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import { COMMON_TIME_ZONES } from "../../domain/tenancy-validation";
import type { ActionState } from "@/modules/core/server/action-state";
import { updateWebsiteAction } from "../../server/actions/website-actions";
import { NativeSelect } from "@/components/app/native-select";

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
