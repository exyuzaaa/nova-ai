"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS } from "../domain/crm";
import {
  archiveCustomerAction,
  createActivityAction,
  deleteContactAction,
  deleteCustomerAction,
  saveContactAction,
} from "../server/actions/customer-actions";

const IDLE: ActionState = { status: "idle" };

const textareaClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export type ContactValues = {
  id?: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export function ContactForm({ tenantId, customerId, contact }: { tenantId: string; customerId: string; contact?: ContactValues }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveContactAction, IDLE, { resetOnSuccess: !contact });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={customerId} />
      {contact?.id && <input type="hidden" name="contactId" value={contact.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Vorname" name="first_name" defaultValue={contact?.firstName ?? ""} error={errors.first_name} />
        <FormField label="Nachname" name="last_name" defaultValue={contact?.lastName ?? ""} error={errors.last_name} />
        <FormField label="Position" name="position" defaultValue={contact?.position ?? ""} error={errors.position} />
        <FormField label="E-Mail-Adresse" name="email" type="email" defaultValue={contact?.email ?? ""} error={errors.email} />
        <FormField label="Telefon" name="phone" type="tel" defaultValue={contact?.phone ?? ""} error={errors.phone} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="is_primary" defaultChecked={contact?.isPrimary ?? false} className="size-4 accent-[var(--brand)]" />
          Hauptansprechpartner
        </label>
      </div>
      <div>
        <Button type="submit" size="sm" variant={contact ? "outline" : "default"} disabled={isPending}>
          {contact ? "Ansprechpartner speichern" : "Ansprechpartner hinzufügen"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteContactButton({ tenantId, contactId, name }: { tenantId: string; contactId: string; name: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(deleteContactAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`Ansprechpartner „${name}“ löschen?`)) onSubmit(event);
        else event.preventDefault();
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="contactId" value={contactId} />
      {state.status === "error" && <FormMessage status="error" message={state.message} />}
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="text-negative hover:text-negative" aria-label={`${name} löschen`}>
        Löschen
      </Button>
    </form>
  );
}

export function ActivityForm({
  tenantId,
  target,
  members,
}: {
  tenantId: string;
  target: { customerId?: string; leadId?: string; opportunityId?: string };
  members: { id: string; label: string }[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(createActivityAction, IDLE, { resetOnSuccess: true });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {target.customerId && <input type="hidden" name="customerId" value={target.customerId} />}
      {target.leadId && <input type="hidden" name="leadId" value={target.leadId} />}
      {target.opportunityId && <input type="hidden" name="opportunityId" value={target.opportunityId} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <NativeSelect label="Art" name="kind" defaultValue="note" error={errors.kind}>
          {ACTIVITY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ACTIVITY_KIND_LABELS[kind]}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Betreff" name="subject" required maxLength={200} error={errors.subject} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`activity-body-${target.customerId ?? target.leadId ?? target.opportunityId}`} className="text-sm font-medium">
          Text (optional)
        </label>
        <textarea
          id={`activity-body-${target.customerId ?? target.leadId ?? target.opportunityId}`}
          name="body"
          rows={3}
          maxLength={10000}
          className={textareaClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Fällig am (für Aufgaben)" name="due_at" type="datetime-local" error={errors.due_at} />
        <NativeSelect label="Zuständig (für Aufgaben)" name="assigned_member_id" defaultValue="" error={errors.assigned_member_id}>
          <option value="">Ich selbst</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : "Eintrag speichern"}
        </Button>
      </div>
    </form>
  );
}

export function ArchiveCustomerButton({ tenantId, customerId, archived }: { tenantId: string; customerId: string; archived: boolean }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(archiveCustomerAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={customerId} />
      {archived && <input type="hidden" name="restore" value="1" />}
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {archived ? "Wiederherstellen" : "Archivieren"}
      </Button>
      {state.status === "error" && <FormMessage status="error" message={state.message} />}
    </form>
  );
}

export function DeleteCustomerButton({ tenantId, customerId, name }: { tenantId: string; customerId: string; name: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(deleteCustomerAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`Kunde „${name}“ endgültig löschen? Ansprechpartner, Verkaufschancen und Aktivitäten werden ebenfalls gelöscht.`)) {
          onSubmit(event);
        } else {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={customerId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="text-negative hover:text-negative">
        Endgültig löschen
      </Button>
      {state.status === "error" && <FormMessage status="error" message={state.message} />}
    </form>
  );
}
