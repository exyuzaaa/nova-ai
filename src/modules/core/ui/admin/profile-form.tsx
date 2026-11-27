"use client";

import { useFormAction } from "@/components/app/use-form-action";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import {
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  COUNTRIES,
  CURRENCIES,
  LOCALE_LABELS,
  LOCALES,
} from "../../domain/admin-validation";
import type { ActionState } from "../../server/action-state";
import { updateTenantProfileAction } from "../../server/actions/admin-actions";

const IDLE: ActionState = { status: "idle" };
const TIME_ZONES = ["Europe/Berlin", "Europe/Vienna", "Europe/Zurich", "Europe/London", "Europe/Paris", "America/New_York", "UTC"];

export type ProfileValues = {
  tenantId: string;
  name: string;
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  vatId: string | null;
  industry: string | null;
  companySize: string | null;
  locale: string;
  timezone: string;
  currency: string;
};

function Group({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ProfileForm({ values, canEdit }: { values: ProfileValues; canEdit: boolean }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(updateTenantProfileAction, IDLE);
  const errors = state.fieldErrors ?? {};
  const disabled = !canEdit;
  const zones = TIME_ZONES.includes(values.timezone) ? TIME_ZONES : [values.timezone, ...TIME_ZONES];
  const countries = COUNTRIES.some((country) => country.code === values.countryCode)
    ? COUNTRIES
    : [{ code: values.countryCode, name: values.countryCode }, ...COUNTRIES];

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="tenantId" value={values.tenantId} />
      <FormMessage status={state.status} message={state.message} />

      <Group legend="Unternehmen">
        <FormField label="Anzeigename" name="name" defaultValue={values.name} required disabled={disabled} error={errors.name} />
        <FormField
          label="Firmierung (laut Handelsregister)"
          name="legal_name"
          defaultValue={values.legalName ?? ""}
          placeholder="z. B. Muster GmbH"
          disabled={disabled}
          error={errors.legal_name}
        />
        <FormField label="Branche" name="industry" defaultValue={values.industry ?? ""} disabled={disabled} error={errors.industry} />
        <NativeSelect label="Unternehmensgröße" name="company_size" defaultValue={values.companySize ?? ""} disabled={disabled} error={errors.company_size}>
          <option value="">Keine Angabe</option>
          {COMPANY_SIZES.map((size) => (
            <option key={size} value={size}>
              {COMPANY_SIZE_LABELS[size]}
            </option>
          ))}
        </NativeSelect>
        <FormField
          label="USt-IdNr."
          name="vat_id"
          defaultValue={values.vatId ?? ""}
          placeholder="DE123456789"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled}
          error={errors.vat_id}
        />
      </Group>

      <Group legend="Anschrift">
        <FormField label="Straße und Hausnummer" name="street" defaultValue={values.street ?? ""} autoComplete="street-address" disabled={disabled} error={errors.street} />
        <FormField label="Postleitzahl" name="postal_code" defaultValue={values.postalCode ?? ""} autoComplete="postal-code" inputMode="numeric" disabled={disabled} error={errors.postal_code} />
        <FormField label="Ort" name="city" defaultValue={values.city ?? ""} autoComplete="address-level2" disabled={disabled} error={errors.city} />
        <NativeSelect label="Land" name="country_code" defaultValue={values.countryCode} disabled={disabled} error={errors.country_code}>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </NativeSelect>
      </Group>

      <Group legend="Kontakt">
        <FormField label="E-Mail-Adresse" name="email" type="email" defaultValue={values.email ?? ""} autoComplete="email" disabled={disabled} error={errors.email} />
        <FormField label="Telefon" name="phone" type="tel" defaultValue={values.phone ?? ""} autoComplete="tel" disabled={disabled} error={errors.phone} />
        <FormField label="Website" name="website" defaultValue={values.website ?? ""} placeholder="beispiel.de" spellCheck={false} disabled={disabled} error={errors.website} />
      </Group>

      <Group legend="Region">
        <NativeSelect label="Sprache" name="locale" defaultValue={values.locale} disabled={disabled} error={errors.locale}>
          {LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Zeitzone" name="timezone" defaultValue={values.timezone} disabled={disabled} error={errors.timezone}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Währung" name="currency" defaultValue={values.currency} disabled={disabled} error={errors.currency}>
          {CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </NativeSelect>
      </Group>

      {canEdit && (
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gespeichert …" : "Profil speichern"}
          </Button>
        </div>
      )}
    </form>
  );
}
