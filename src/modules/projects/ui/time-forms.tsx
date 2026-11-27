"use client";

import { useEffect, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { formatMinutes } from "../domain/projects";
import { copyProjectAction, deleteTimeEntryAction, saveTimeEntryAction, startTimerAction, stopTimerAction } from "../server/actions/time-actions";
import { ActionButton, type Option } from "./project-forms";

const IDLE: ActionState = { status: "idle" };

/** Laufende Dauer seit `since`, aktualisiert jede halbe Minute. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="font-mono tabular-nums">{formatMinutes(Math.max(0, Math.floor((now - Date.parse(since)) / 60000)))}</span>;
}

export type RunningTimer = { projectName: string; taskTitle: string | null; startedAt: string; note: string | null };

/** Stoppuhr: zeigt die laufende Zeit oder startet eine neue (Projekt wählbar oder fest). */
export function TimerCard({
  tenantId,
  running,
  projects,
  projectId,
  taskId,
  startLabel = "Stoppuhr starten",
}: {
  tenantId: string;
  running: RunningTimer | null;
  projects?: Option[];
  projectId?: string;
  taskId?: string;
  startLabel?: string;
}) {
  const { state: startState, isPending: starting, formRef: startRef, onSubmit: onStart } = useFormAction(startTimerAction, IDLE, {
    resetOnSuccess: true,
  });
  const { state: stopState, isPending: stopping, formRef: stopRef, onSubmit: onStop } = useFormAction(stopTimerAction, IDLE);
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4" role="region" aria-label="Stoppuhr">
      {running && (
        <form ref={stopRef} onSubmit={onStop} className="flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" name="tenantId" value={tenantId} />
          <p className="min-w-0 text-sm">
            <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-negative align-middle" aria-hidden />
            Läuft seit <Elapsed since={running.startedAt} />:{" "}
            <span className="font-medium">
              {running.projectName}
              {running.taskTitle ? ` · ${running.taskTitle}` : ""}
            </span>
            {running.note && <span className="text-muted-foreground"> – {running.note}</span>}
          </p>
          <Button type="submit" size="sm" variant="outline" disabled={stopping}>
            <Square className="size-4" aria-hidden />
            Stoppen
          </Button>
          {stopState.status === "error" && <FormMessage status="error" message={stopState.message} />}
        </form>
      )}
      <form ref={startRef} onSubmit={onStart} className="flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="tenantId" value={tenantId} />
        {projectId ? (
          <input type="hidden" name="projectId" value={projectId} />
        ) : (
          <NativeSelect label="Projekt" name="projectId" defaultValue="" className="min-w-48 flex-1" error={startState.fieldErrors?.projectId}>
            <option value="">– auswählen –</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </NativeSelect>
        )}
        {taskId && <input type="hidden" name="taskId" value={taskId} />}
        <div className="min-w-40 flex-1">
          <FormField label="Woran arbeitest du?" name="note" maxLength={1000} placeholder="optional" />
        </div>
        <Button type="submit" size="sm" disabled={starting}>
          <Play className="size-4" aria-hidden />
          {running ? "Neue Stoppuhr starten" : startLabel}
        </Button>
        {startState.status === "error" && startState.message && (
          <p role="alert" className="basis-full text-xs text-negative">
            {startState.message}
          </p>
        )}
      </form>
      {running && <p className="text-xs text-muted-foreground">Eine neue Stoppuhr beendet die laufende automatisch.</p>}
    </div>
  );
}

export type TimeEntryValues = {
  id: string;
  projectId: string;
  taskId: string | null;
  date: string;
  start: string;
  end: string;
  note: string | null;
  billable: boolean;
};

/** Zeit nachtragen (neu) oder Eintrag ändern. */
export function TimeEntryForm({
  tenantId,
  today,
  projects,
  projectId,
  tasks,
  values,
}: {
  tenantId: string;
  today: string;
  projects?: Option[];
  projectId?: string;
  tasks?: Option[];
  values?: TimeEntryValues;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveTimeEntryAction, IDLE, { resetOnSuccess: !values });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values && <input type="hidden" name="entryId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {projectId || values ? (
          <input type="hidden" name="projectId" value={values?.projectId ?? projectId} />
        ) : (
          <div className="col-span-2 sm:col-span-4">
            <NativeSelect label="Projekt" name="projectId" defaultValue="" error={errors.projectId}>
              <option value="">– auswählen –</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {tasks && tasks.length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <NativeSelect label="Aufgabe" name="taskId" defaultValue={values?.taskId ?? ""}>
              <option value="">– ohne Aufgabe –</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <FormField label="Datum" name="date" type="date" defaultValue={values?.date ?? today} required error={errors.date} />
        <FormField label="Beginn" name="start" type="time" defaultValue={values?.start ?? ""} required error={errors.start} />
        <FormField label="Ende" name="end" type="time" defaultValue={values?.end ?? ""} error={errors.end} />
        <FormField label="oder Dauer" name="duration" placeholder="1:30" hint="z. B. 1:30 oder 2,5" error={errors.duration} />
      </div>
      <FormField label="Notiz" name="note" defaultValue={values?.note ?? ""} maxLength={1000} error={errors.note} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="billable" value="1" defaultChecked={values?.billable ?? true} />
        Abrechenbar
      </label>
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {values ? "Speichern" : "Zeit eintragen"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteTimeEntryButton({ tenantId, entryId, label }: { tenantId: string; entryId: string; label: string }) {
  return (
    <ActionButton action={deleteTimeEntryAction} fields={{ tenantId, entryId }} label={`Zeiteintrag ${label} löschen`} confirm="Zeiteintrag löschen?" className="text-muted-foreground">
      <Trash2 className="size-3.5" aria-hidden />
    </ActionButton>
  );
}

/** Projekt aus Vorlage anlegen oder Projekt als Vorlage speichern. */
export function CopyProjectForm({
  tenantId,
  sources,
  sourceId,
  asTemplate,
  defaultName,
  submitLabel,
}: {
  tenantId: string;
  sources?: Option[];
  sourceId?: string;
  asTemplate: boolean;
  defaultName?: string;
  submitLabel: string;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(copyProjectAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="asTemplate" value={asTemplate ? "1" : "0"} />
      <FormMessage status={state.status} message={state.message} />
      {sourceId ? (
        <input type="hidden" name="sourceId" value={sourceId} />
      ) : (
        <NativeSelect label="Vorlage" name="sourceId" defaultValue="" error={errors.sourceId}>
          <option value="">– auswählen –</option>
          {(sources ?? []).map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </NativeSelect>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={asTemplate ? "Name der Vorlage" : "Name des Projekts"} name="name" defaultValue={defaultName} required maxLength={200} error={errors.name} />
        {!asTemplate && (
          <FormField label="Startdatum" name="startDate" type="date" hint="Termine werden passend verschoben." error={errors.startDate} />
        )}
      </div>
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird angelegt …" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
