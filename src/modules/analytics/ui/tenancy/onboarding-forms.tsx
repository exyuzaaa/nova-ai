"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import { COMMON_TIME_ZONES } from "../../domain/tenancy-validation";
import { createTenantAction } from "@/modules/core/server/actions/tenant-actions";
import type { ActionState } from "@/modules/core/server/action-state";
import { createWebsiteAction } from "../../server/actions/website-actions";
import { NativeSelect } from "@/components/app/native-select";

const IDLE: ActionState = { status: "idle" };

export function CreateTenantForm() {
  const [state, formAction, isPending] = useActionState(createTenantAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Schritt 1 von 2</p>
        <h1 className="text-lg font-semibold tracking-tight">Unternehmen anlegen</h1>
        <p className="text-sm text-muted-foreground">
          In deinem Unternehmen verwaltest du Teammitglieder, Module und Websites. Daten verschiedener Unternehmen sind
          strikt getrennt.
        </p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <FormField label="Name des Unternehmens" name="name" required maxLength={120} autoComplete="organization" error={state.fieldErrors?.name} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angelegt …" : "Weiter"}
      </Button>
    </form>
  );
}

export function CreateWebsiteForm({
  tenants,
  isFirst,
}: {
  tenants: { id: string; name: string }[];
  isFirst: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createWebsiteAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        {isFirst && <p className="text-xs font-medium text-muted-foreground">Schritt 2 von 2</p>}
        <h1 className="text-lg font-semibold tracking-tight">{isFirst ? "Erste Website hinzufügen" : "Website hinzufügen"}</h1>
        <p className="text-sm text-muted-foreground">Jede Website erhält eine eigene Tracking-ID.</p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      {tenants.length > 1 ? (
        <NativeSelect label="Unternehmen" name="tenantId" defaultValue={tenants[0].id}>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <input type="hidden" name="tenantId" value={tenants[0]?.id ?? ""} />
      )}
      <FormField label="Name der Website" name="name" required maxLength={120} placeholder="z. B. Unternehmenswebsite" error={state.fieldErrors?.name} />
      <FormField
        label="Domain"
        name="domain"
        required
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="beispiel.de"
        hint="Ohne https:// – Unterseiten und www werden automatisch zugeordnet."
        error={state.fieldErrors?.domain}
      />
      <NativeSelect label="Zeitzone für Tagesauswertungen" name="timezone" defaultValue="Europe/Berlin" error={state.fieldErrors?.timezone}>
        {COMMON_TIME_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird hinzugefügt …" : "Website hinzufügen"}
      </Button>
    </form>
  );
}
