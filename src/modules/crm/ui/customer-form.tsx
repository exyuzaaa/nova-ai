"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import { COUNTRIES } from "@/modules/core/domain/admin-validation";
import { CUSTOMER_KIND_LABELS, CUSTOMER_KINDS, CUSTOMER_STATUS_LABELS, CUSTOMER_STATUSES } from "../domain/crm";
import { createCustomerAction, updateCustomerAction, type CustomerActionState } from "../server/actions/customer-actions";

const IDLE: CustomerActionState = { status: "idle" };

export type CustomerFormValues = {
  id?: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  vatId: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  status: string;
  category: string | null;
  tags: string[];
  description: string | null;
  ownerMemberId: string | null;
};

export const EMPTY_CUSTOMER: CustomerFormValues = {
  kind: "company",
  name: "",
  email: null,
  phone: null,
  website: null,
  vatId: null,
  street: null,
  postalCode: null,
  city: null,
  countryCode: "DE",
  status: "active",
  category: null,
  tags: [],
  description: null,
  ownerMemberId: null,
};

export function CustomerForm({
  tenantId,
  base,
  values,
  members,
}: {
  tenantId: string;
  base: string;
  values: CustomerFormValues;
  members: { id: string; label: string }[];
}) {
  const isNew = !values.id;
  const { state, isPending, formRef, onSubmit } = useFormAction(isNew ? createCustomerAction : updateCustomerAction, IDLE);
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values.id && <input type="hidden" name="customerId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />

      {state.duplicates && state.duplicates.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-negative/30 p-3" role="group" aria-label="Mögliche Dubletten">
          <ul className="flex flex-col gap-1 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link href={`${base}/crm/kunden/${duplicate.id}`} className="font-medium text-brand hover:underline">
                  {duplicate.number} · {duplicate.name}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  – {duplicate.reason === "email" ? "gleiche E-Mail-Adresse" : "ähnlicher Name"}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button type="submit" name="confirmDuplicate" value="1" variant="outline" size="sm" disabled={isPending}>
              Trotzdem anlegen
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <NativeSelect label="Art" name="kind" defaultValue={values.kind} error={errors.kind}>
          {CUSTOMER_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CUSTOMER_KIND_LABELS[kind]}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Name" name="name" defaultValue={values.name} required maxLength={200} error={errors.name} />
        <FormField label="E-Mail-Adresse" name="email" type="email" defaultValue={values.email ?? ""} error={errors.email} />
        <FormField label="Telefon" name="phone" type="tel" defaultValue={values.phone ?? ""} error={errors.phone} />
        <FormField label="Website" name="website" defaultValue={values.website ?? ""} error={errors.website} />
        <FormField label="USt-IdNr." name="vat_id" defaultValue={values.vatId ?? ""} error={errors.vat_id} />
        <FormField label="Straße und Hausnummer" name="street" defaultValue={values.street ?? ""} error={errors.street} />
        <FormField label="Postleitzahl" name="postal_code" defaultValue={values.postalCode ?? ""} error={errors.postal_code} />
        <FormField label="Ort" name="city" defaultValue={values.city ?? ""} error={errors.city} />
        <NativeSelect label="Land" name="country_code" defaultValue={values.countryCode} error={errors.country_code}>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Status" name="status" defaultValue={values.status} error={errors.status}>
          {CUSTOMER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CUSTOMER_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Zuständig" name="owner_member_id" defaultValue={values.ownerMemberId ?? ""} error={errors.owner_member_id}>
          <option value="">Niemand</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Kategorie" name="category" defaultValue={values.category ?? ""} error={errors.category} />
        <FormField
          label="Schlagwörter"
          name="tags"
          defaultValue={values.tags.join(", ")}
          hint="Mit Komma trennen, z. B. B2B, Stammkunde"
          error={errors.tags}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customer-description" className="text-sm font-medium">
          Beschreibung
        </label>
        <textarea
          id="customer-description"
          name="description"
          defaultValue={values.description ?? ""}
          maxLength={5000}
          rows={4}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : isNew ? "Kunde anlegen" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}
