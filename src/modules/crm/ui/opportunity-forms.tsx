"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import {
  createOpportunityAction,
  deleteOpportunityAction,
  moveOpportunityAction,
  updateOpportunityAction,
} from "../server/actions/opportunity-actions";

const IDLE: ActionState = { status: "idle" };

export type StageOption = { id: string; name: string; probability: number; kind: "open" | "won" | "lost" };

export type OpportunityFormValues = {
  id?: string;
  customerId: string;
  pipelineId: string;
  title: string;
  /** formatiert, z. B. "12.000,00" */
  amount: string;
  stageId: string;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerMemberId: string | null;
  lostReason: string | null;
  notes: string | null;
};

const stageLabel = (stage: StageOption) =>
  stage.kind === "open" ? `${stage.name} (${stage.probability} %)` : stage.kind === "won" ? `${stage.name} ✓` : `${stage.name} ✗`;

export function OpportunityForm({
  tenantId,
  values,
  stages,
  members,
}: {
  tenantId: string;
  values: OpportunityFormValues;
  stages: StageOption[];
  members: { id: string; label: string }[];
}) {
  const isNew = !values.id;
  const { state, isPending, formRef, onSubmit } = useFormAction(isNew ? createOpportunityAction : updateOpportunityAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customerId" value={values.customerId} />
      <input type="hidden" name="pipelineId" value={values.pipelineId} />
      {values.id && <input type="hidden" name="opportunityId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="Titel" name="title" defaultValue={values.title} required maxLength={200} placeholder="z. B. Wartungsvertrag 2027" error={errors.title} />
        </div>
        <FormField label="Betrag (€)" name="amount" inputMode="decimal" defaultValue={values.amount} required placeholder="z. B. 12.000,00" error={errors.amount} />
        <NativeSelect label="Phase" name="stage_id" defaultValue={values.stageId} error={errors.stage_id}>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stageLabel(stage)}
            </option>
          ))}
        </NativeSelect>
        <FormField
          label="Eigene Wahrscheinlichkeit (%)"
          name="probability"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          defaultValue={values.probability === null ? "" : String(values.probability)}
          hint="Leer lassen, um die Wahrscheinlichkeit der Phase zu verwenden."
          error={errors.probability}
        />
        <FormField label="Erwarteter Abschluss" name="expected_close_date" type="date" defaultValue={values.expectedCloseDate ?? ""} error={errors.expected_close_date} />
        <NativeSelect label="Zuständig" name="owner_member_id" defaultValue={values.ownerMemberId ?? ""} error={errors.owner_member_id}>
          <option value="">Niemand</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Grund bei Verlust" name="lost_reason" defaultValue={values.lostReason ?? ""} hint="Nur für verlorene Chancen." error={errors.lost_reason} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`opportunity-notes-${values.id ?? "neu"}`} className="text-sm font-medium">
          Notizen
        </label>
        <textarea
          id={`opportunity-notes-${values.id ?? "neu"}`}
          name="notes"
          defaultValue={values.notes ?? ""}
          maxLength={5000}
          rows={3}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : isNew ? "Verkaufschance anlegen" : "Änderungen speichern"}
        </Button>
      </div>
    </form>
  );
}

/** Phase wechseln direkt auf der Karte (Tastatur und Screenreader statt Ziehen). */
export function MoveStageForm({
  tenantId,
  opportunityId,
  title,
  currentStageId,
  stages,
}: {
  tenantId: string;
  opportunityId: string;
  title: string;
  currentStageId: string;
  stages: StageOption[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(moveOpportunityAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex items-end gap-1.5">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <NativeSelect label={`Phase von ${title}`} hideLabel name="stageId" defaultValue={currentStageId} className="min-w-0 flex-1">
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" variant="outline" size="sm" disabled={isPending} aria-label={`${title} in gewählte Phase verschieben`}>
        OK
      </Button>
      {state.status === "error" && (
        <span role="alert" className="sr-only">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function DeleteOpportunityButton({ tenantId, opportunityId, title }: { tenantId: string; opportunityId: string; title: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(deleteOpportunityAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`Verkaufschance „${title}“ endgültig löschen?`)) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="text-negative hover:text-negative">
        Endgültig löschen
      </Button>
      {state.status === "error" && <FormMessage status="error" message={state.message} />}
    </form>
  );
}
