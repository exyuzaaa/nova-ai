"use client";

import { Button } from "@/components/ui/button";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { ActionButton, Textarea } from "@/modules/projects/ui/project-forms";
import { disconnectGmailAction, sendDocumentEmailAction } from "../server/actions/mail-actions";

const IDLE: ActionState = { status: "idle" };

export function DisconnectGmailButton({ tenantId }: { tenantId: string }) {
  return (
    <ActionButton action={disconnectGmailAction} fields={{ tenantId }} variant="outline" confirm="Gmail trennen? Belege können danach nicht mehr per E-Mail versendet werden.">
      Gmail trennen
    </ActionButton>
  );
}

export function SendMailForm({
  tenantId,
  documentId,
  from,
  defaults,
}: {
  tenantId: string;
  documentId: string;
  from: string;
  defaults: { to: string; subject: string; message: string; attachment: string };
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(sendDocumentEmailAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate aria-label="E-Mail senden">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="documentId" value={documentId} />
      <FormMessage status={state.status} message={state.message} />
      <p className="text-sm text-muted-foreground">
        Absender: <span className="text-foreground">{from}</span> · Anhang: <span className="text-foreground">{defaults.attachment}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="An" name="to" type="text" inputMode="email" defaultValue={defaults.to} hint="Mehrere Adressen mit Komma trennen." error={errors.to} />
        <FormField label="Kopie (CC)" name="cc" type="text" inputMode="email" defaultValue="" error={errors.cc} />
      </div>
      <FormField label="Betreff" name="subject" defaultValue={defaults.subject} maxLength={300} error={errors.subject} />
      <Textarea label="Nachricht" name="message" defaultValue={defaults.message} maxLength={10000} rows={8} error={errors.message} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gesendet …" : "E-Mail senden"}
        </Button>
      </div>
    </form>
  );
}
