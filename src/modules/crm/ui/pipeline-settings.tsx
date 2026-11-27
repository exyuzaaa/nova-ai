"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import {
  addStageAction,
  createPipelineAction,
  deletePipelineAction,
  deleteStageAction,
  moveStageAction,
  renamePipelineAction,
  setDefaultPipelineAction,
  updateStageAction,
} from "../server/actions/pipeline-actions";

const IDLE: ActionState = { status: "idle" };

export type SettingsStage = {
  id: string;
  name: string;
  probability: number;
  kind: "open" | "won" | "lost";
};
export type SettingsPipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: SettingsStage[];
  opportunityCount: number;
};

const KIND_HINT = {
  won: "Abschluss gewonnen · 100 %",
  lost: "Abschluss verloren · 0 %",
} as const;

/** Kleines Formular mit einem Knopf (Verschieben, Standard, Löschen). */
function ActionButton({
  action,
  fields,
  label,
  children,
  confirm,
  variant = "ghost",
  className,
  disabled = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: string;
  children: React.ReactNode;
  confirm?: string;
  variant?: "ghost" | "outline";
  className?: string;
  disabled?: boolean;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(action, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (!confirm || window.confirm(confirm)) onSubmit(event);
        else event.preventDefault();
      }}
      className="contents"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size="sm"
        disabled={isPending || disabled}
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </Button>
      {state.status === "error" && (
        <span role="alert" className="basis-full text-xs text-negative">
          {state.message}
        </span>
      )}
    </form>
  );
}

function StageRow({ tenantId, stage, first, last }: { tenantId: string; stage: SettingsStage; first: boolean; last: boolean }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(updateStageAction, IDLE);
  const errors = state.fieldErrors ?? {};
  const open = stage.kind === "open";
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start" aria-label={`Phase ${stage.name}`}>
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-1 flex-wrap items-start gap-2" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="stageId" value={stage.id} />
        <div className="min-w-40 flex-1">
          <FormField label="Name der Phase" name="name" defaultValue={stage.name} required maxLength={80} error={errors.name} />
        </div>
        {open ? (
          <div className="w-32">
            <FormField
              label="Wahrscheinlichkeit %"
              name="probability"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              defaultValue={stage.probability}
              required
              error={errors.probability}
            />
          </div>
        ) : (
          <p className="self-end pb-2">
            <Badge variant="outline" className="h-5 text-[11px]">
              {KIND_HINT[stage.kind as "won" | "lost"]}
            </Badge>
          </p>
        )}
        <Button type="submit" size="sm" variant="outline" disabled={isPending} className="self-end">
          Speichern
        </Button>
        <div className="basis-full empty:hidden">
          <FormMessage status={state.status} message={state.message} />
        </div>
      </form>
      {open && (
        <div className="flex flex-wrap items-center gap-1 sm:pt-6">
          <ActionButton
            action={moveStageAction}
            fields={{ tenantId, stageId: stage.id, direction: "up" }}
            label={`${stage.name} nach oben`}
            disabled={first}
          >
            <ArrowUp className="size-4" aria-hidden />
          </ActionButton>
          <ActionButton
            action={moveStageAction}
            fields={{ tenantId, stageId: stage.id, direction: "down" }}
            label={`${stage.name} nach unten`}
            disabled={last}
          >
            <ArrowDown className="size-4" aria-hidden />
          </ActionButton>
          <ActionButton
            action={deleteStageAction}
            fields={{ tenantId, stageId: stage.id }}
            label={`Phase ${stage.name} löschen`}
            disabled={first && last}
            confirm={`Phase „${stage.name}“ löschen?`}
            className="text-negative hover:text-negative"
          >
            <Trash2 className="size-4" aria-hidden />
          </ActionButton>
        </div>
      )}
    </li>
  );
}

function AddStageForm({ tenantId, pipelineId }: { tenantId: string; pipelineId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(addStageAction, IDLE, { resetOnSuccess: true });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-start gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="pipelineId" value={pipelineId} />
      <div className="min-w-40 flex-1">
        <FormField label="Neue Phase" name="name" required maxLength={80} placeholder="z. B. Vor-Ort-Termin" error={errors.name} />
      </div>
      <div className="w-32">
        <FormField
          label="Wahrscheinlichkeit %"
          name="probability"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          defaultValue={50}
          required
          error={errors.probability}
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="self-end">
        Hinzufügen
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

function PipelineNameForm({ tenantId, pipeline }: { tenantId: string; pipeline: SettingsPipeline }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(renamePipelineAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-start gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="pipelineId" value={pipeline.id} />
      <div className="min-w-48 flex-1">
        <FormField
          label="Name der Pipeline"
          name="name"
          defaultValue={pipeline.name}
          required
          maxLength={120}
          error={state.fieldErrors?.name}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="self-end">
        Speichern
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function PipelineSettings({ tenantId, pipeline }: { tenantId: string; pipeline: SettingsPipeline }) {
  const openStages = pipeline.stages.filter((stage) => stage.kind === "open");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {pipeline.isDefault ? (
          <Badge className="h-5 text-[11px]">Standard</Badge>
        ) : (
          <ActionButton
            action={setDefaultPipelineAction}
            fields={{ tenantId, pipelineId: pipeline.id }}
            label="Als Standard festlegen"
            variant="outline"
          >
            Als Standard festlegen
          </ActionButton>
        )}
        <span>
          {pipeline.opportunityCount} {pipeline.opportunityCount === 1 ? "Verkaufschance" : "Verkaufschancen"}
        </span>
        {!pipeline.isDefault && pipeline.opportunityCount === 0 && (
          <ActionButton
            action={deletePipelineAction}
            fields={{ tenantId, pipelineId: pipeline.id }}
            label="Pipeline löschen"
            confirm={`Pipeline „${pipeline.name}“ mit allen Phasen löschen?`}
            className="text-negative hover:text-negative"
          >
            Pipeline löschen
          </ActionButton>
        )}
      </div>
      <PipelineNameForm tenantId={tenantId} pipeline={pipeline} />
      <div>
        <h3 className="text-sm font-medium">Phasen</h3>
        <p className="text-xs text-muted-foreground">
          Die Wahrscheinlichkeit bestimmt den gewichteten Umsatz. „Gewonnen“ und „Verloren“ bleiben immer am Ende. Phasen mit
          Verkaufschancen lassen sich erst löschen, wenn die Chancen verschoben sind.
        </p>
        <ol className="flex flex-col divide-y">
          {pipeline.stages.map((stage) => (
            <StageRow
              key={stage.id}
              tenantId={tenantId}
              stage={stage}
              first={stage.id === openStages[0]?.id}
              last={stage.id === openStages.at(-1)?.id}
            />
          ))}
        </ol>
      </div>
      <AddStageForm tenantId={tenantId} pipelineId={pipeline.id} />
    </div>
  );
}

export function CreatePipelineForm({ tenantId }: { tenantId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(createPipelineAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-start gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="min-w-48 flex-1">
        <FormField
          label="Name"
          name="name"
          required
          maxLength={120}
          placeholder="z. B. Service-Verträge"
          hint="Startet mit den Phasen Neu, Angebot, Gewonnen und Verloren."
          error={state.fieldErrors?.name}
        />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="self-start sm:mt-[1.375rem]">
        Pipeline anlegen
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}
