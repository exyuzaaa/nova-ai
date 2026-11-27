"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { EDITABLE_LEAD_STATUSES, LEAD_SOURCE_LABELS, LEAD_SOURCES, LEAD_STATUS_LABELS } from "../domain/crm";
import { convertLeadAction, createLeadAction, deleteLeadAction, updateLeadAction } from "../server/actions/lead-actions";

const IDLE: ActionState = { status: "idle" };

export type LeadFormValues = {
  id?: string;
  title: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  score: number;
  /** Bereits als Text formatiert ("8.500,00"), damit die Eingabe so erscheint, wie sie gemeint war */
  estimatedValue: string;
  ownerMemberId: string | null;
  /** Wert für datetime-local in der Zeitzone des Unternehmens */
  followUpLocal: string;
  notes: string | null;
};

export const EMPTY_LEAD: LeadFormValues = {
  title: "",
  companyName: null,
  contactName: null,
  email: null,
  phone: null,
  source: "website",
  status: "new",
  score: 0,
  estimatedValue: "",
  ownerMemberId: null,
  followUpLocal: "",
  notes: null,
};

export function LeadForm({ tenantId, values, members }: { tenantId: string; values: LeadFormValues; members: { id: string; label: string }[] }) {
  const isNew = !values.id;
  const { state, isPending, formRef, onSubmit } = useFormAction(isNew ? createLeadAction : updateLeadAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values.id && <input type="hidden" name="leadId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Titel" name="title" defaultValue={values.title} required maxLength={200} placeholder="z. B. Anfrage Website-Relaunch" error={errors.title} />
        </div>
        <FormField label="Firma" name="company_name" defaultValue={values.companyName ?? ""} error={errors.company_name} />
        <FormField label="Ansprechperson" name="contact_name" defaultValue={values.contactName ?? ""} error={errors.contact_name} />
        <FormField label="E-Mail-Adresse" name="email" type="email" defaultValue={values.email ?? ""} error={errors.email} />
        <FormField label="Telefon" name="phone" type="tel" defaultValue={values.phone ?? ""} error={errors.phone} />
        <NativeSelect label="Quelle" name="source" defaultValue={values.source} error={errors.source}>
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {LEAD_SOURCE_LABELS[source]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Status" name="status" defaultValue={values.status} error={errors.status}>
          {EDITABLE_LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
        <FormField
          label="Bewertung (0–100)"
          name="score"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          defaultValue={String(values.score)}
          hint="Wie wahrscheinlich wird daraus ein Auftrag?"
          error={errors.score}
        />
        <FormField
          label="Geschätzter Wert (€)"
          name="estimated_value"
          inputMode="decimal"
          defaultValue={values.estimatedValue}
          placeholder="z. B. 8.500,00"
          error={errors.estimated_value}
        />
        <NativeSelect label="Zuständig" name="owner_member_id" defaultValue={values.ownerMemberId ?? ""} error={errors.owner_member_id}>
          <option value="">Niemand</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        <FormField
          label="Wiedervorlage"
          name="follow_up_at"
          type="datetime-local"
          defaultValue={values.followUpLocal}
          hint="NOVA erinnert dich zu diesem Zeitpunkt."
          error={errors.follow_up_at}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-notes" className="text-sm font-medium">
          Notizen
        </label>
        <textarea
          id="lead-notes"
          name="notes"
          defaultValue={values.notes ?? ""}
          maxLength={5000}
          rows={4}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
        {errors.notes && <p className="text-xs text-negative">{errors.notes}</p>}
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : isNew ? "Lead anlegen" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}

export function ConvertLeadForm({
  tenantId,
  leadId,
  suggestions,
  hasEstimatedValue,
}: {
  tenantId: string;
  leadId: string;
  suggestions: { id: string; label: string }[];
  hasEstimatedValue: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(convertLeadAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="leadId" value={leadId} />
      <FormMessage status={state.status} message={state.message} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Kunde</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="customerId" value="" defaultChecked className="size-4 accent-[var(--brand)]" />
          Neuen Kunden anlegen
        </label>
        {suggestions.map((suggestion) => (
          <label key={suggestion.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="customerId" value={suggestion.id} className="size-4 accent-[var(--brand)]" />
            Bestehendem Kunden zuordnen: {suggestion.label}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="createOpportunity" defaultChecked={hasEstimatedValue} className="size-4 accent-[var(--brand)]" />
        Verkaufschance in der Pipeline anlegen
      </label>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird umgewandelt …" : "In Kunden umwandeln"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteLeadButton({ tenantId, leadId, title }: { tenantId: string; leadId: string; title: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(deleteLeadAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`Lead „${title}“ endgültig löschen?`)) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="leadId" value={leadId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="text-negative hover:text-negative">
        Endgültig löschen
      </Button>
      {state.status === "error" && <FormMessage status="error" message={state.message} />}
    </form>
  );
}
