"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { CopyButton } from "@/components/app/copy-button";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { ActionButton, Textarea } from "@/modules/projects/ui/project-forms";
import { REMINDER_OPTIONS, REPEAT_FREQUENCIES, REPEAT_LABELS, REPEAT_UNITS, WEEKDAYS, type RepeatFrequency } from "../domain/calendar";
import { deleteEventAction, feedAction, respondAction, saveEventAction } from "../server/actions/event-actions";

const IDLE: ActionState = { status: "idle" };
type Option = { id: string; label: string };

export type EventFormValues = {
  id?: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  repeatFreq: RepeatFrequency | null;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
  reminderMinutes: number | null;
  attendees: string[];
};

export function EventForm({
  tenantId,
  values,
  calendars,
  members,
}: {
  tenantId: string;
  values: EventFormValues;
  calendars: Option[];
  members: Option[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveEventAction, IDLE);
  const errors = state.fieldErrors ?? {};
  const [allDay, setAllDay] = useState(values.allDay);
  const [repeat, setRepeat] = useState<string>(values.repeatFreq ?? "none");
  const [repeatEnd, setRepeatEnd] = useState(values.repeatUntil ? "until" : values.repeatCount ? "count" : "never");
  const unit = repeat !== "none" ? REPEAT_UNITS[repeat as RepeatFrequency][1] : "";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values.id && <input type="hidden" name="eventId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <FormField label="Titel" name="title" defaultValue={values.title} required maxLength={200} placeholder="z. B. Teamrunde" error={errors.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NativeSelect label="Kalender" name="calendar_id" defaultValue={values.calendarId} error={errors.calendar_id}>
          {calendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.label}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Ort" name="location" defaultValue={values.location ?? ""} maxLength={300} placeholder="Raum, Adresse oder Link" error={errors.location} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="all_day" value="1" checked={allDay} onChange={(event) => setAllDay(event.currentTarget.checked)} />
        Ganztägig
      </label>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <FormField label={allDay ? "Erster Tag" : "Beginn (Datum)"} name="start_date" type="date" defaultValue={values.startDate} required error={errors.start_date} />
        {allDay ? (
          <input type="hidden" name="start_time" value="" />
        ) : (
          <FormField label="Beginn (Uhrzeit)" name="start_time" type="time" defaultValue={values.startTime} required error={errors.start_time} />
        )}
        <FormField label={allDay ? "Letzter Tag" : "Ende (Datum)"} name="end_date" type="date" defaultValue={values.endDate} required error={errors.end_date} />
        {allDay ? (
          <input type="hidden" name="end_time" value="" />
        ) : (
          <FormField label="Ende (Uhrzeit)" name="end_time" type="time" defaultValue={values.endTime} required error={errors.end_time} />
        )}
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Wiederholung</legend>
        <div className="flex flex-wrap items-end gap-3">
          <NativeSelect label="Wiederholen" name="repeat" value={repeat} onChange={(event) => setRepeat(event.currentTarget.value)} error={errors.repeat}>
            <option value="none">Nicht wiederholen</option>
            {REPEAT_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {REPEAT_LABELS[frequency]}
              </option>
            ))}
          </NativeSelect>
          {repeat !== "none" && (
            <div className="w-36">
              <FormField label={`Alle … ${unit}`} name="repeat_interval" type="number" min={1} max={99} defaultValue={values.repeatInterval} error={errors.repeat_interval} />
            </div>
          )}
        </div>
        {repeat === "weekly" && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs text-muted-foreground">An diesen Tagen (leer = wie der erste Termin)</legend>
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
                <input type="checkbox" name="repeat_weekdays" value={day.value} defaultChecked={values.repeatWeekdays.includes(day.value)} />
                <span aria-hidden>{day.short}</span>
                <span className="sr-only">{day.long}</span>
              </label>
            ))}
          </fieldset>
        )}
        {repeat !== "none" && (
          <div className="flex flex-wrap items-end gap-3">
            <NativeSelect label="Ende der Serie" name="repeat_end" value={repeatEnd} onChange={(event) => setRepeatEnd(event.currentTarget.value)}>
              <option value="never">Ohne Ende</option>
              <option value="until">An einem Datum</option>
              <option value="count">Nach Anzahl</option>
            </NativeSelect>
            {repeatEnd === "until" && (
              <FormField label="Letzter möglicher Tag" name="repeat_until" type="date" defaultValue={values.repeatUntil ?? ""} error={errors.repeat_until} />
            )}
            {repeatEnd === "count" && (
              <div className="w-32">
                <FormField label="Anzahl Termine" name="repeat_count" type="number" min={1} max={500} defaultValue={values.repeatCount ?? 10} error={errors.repeat_count} />
              </div>
            )}
          </div>
        )}
      </fieldset>

      <NativeSelect label="Erinnerung" name="reminder_minutes" defaultValue={values.reminderMinutes === null ? "" : String(values.reminderMinutes)} error={errors.reminder_minutes}>
        {REMINDER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>

      {members.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Personen einladen</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {members.map((member) => (
              <label key={member.id} className="flex min-w-0 items-center gap-2 text-sm">
                <input type="checkbox" name="attendees" value={member.id} defaultChecked={values.attendees.includes(member.id)} />
                <span className="truncate">{member.label}</span>
              </label>
            ))}
          </div>
          {errors.attendees && <p className="text-xs text-negative">{errors.attendees}</p>}
        </fieldset>
      )}

      <Textarea label="Beschreibung" name="description" defaultValue={values.description} maxLength={5000} rows={3} error={errors.description} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : values.id ? "Änderungen speichern" : "Termin anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function RespondButtons({ tenantId, eventId, current }: { tenantId: string; eventId: string; current: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Antwort auf die Einladung">
      {(
        [
          ["accepted", "Zusagen"],
          ["tentative", "Vielleicht"],
          ["declined", "Absagen"],
        ] as const
      ).map(([response, label]) => (
        <ActionButton key={response} action={respondAction} fields={{ tenantId, eventId, response }} variant={current === response ? "default" : "outline"}>
          {label}
        </ActionButton>
      ))}
    </div>
  );
}

export function DeleteEventButtons({ tenantId, eventId, title, occurrence }: { tenantId: string; eventId: string; title: string; occurrence?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {occurrence && (
        <ActionButton action={deleteEventAction} fields={{ tenantId, eventId, occurrence }} variant="outline" confirm="Nur diesen Termin der Serie streichen?">
          Nur diesen Termin streichen
        </ActionButton>
      )}
      <ActionButton
        action={deleteEventAction}
        fields={{ tenantId, eventId }}
        confirm={occurrence ? `Die ganze Serie „${title}“ löschen?` : `Termin „${title}“ löschen?`}
        className="text-negative hover:text-negative"
      >
        {occurrence ? "Ganze Serie löschen" : "Termin löschen"}
      </ActionButton>
    </div>
  );
}

/** Abo-Link für Kalender-Apps erstellen oder widerrufen; der Link wird nur einmal angezeigt. */
export function FeedSettings({ tenantId, hasToken }: { tenantId: string; hasToken: boolean }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(feedAction, IDLE);
  return (
    <div className="flex flex-col gap-3">
      <FormMessage status={state.status} message={state.message} />
      {state.invitationLink && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Dein persönlicher Abo-Link (nur jetzt sichtbar):</p>
          <code className="break-all text-xs">{state.invitationLink}</code>
          <div>
            <CopyButton value={state.invitationLink} label="Link kopieren" />
          </div>
        </div>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <Button type="submit" size="sm" name="intent" value="create" disabled={isPending}>
          {hasToken ? "Neuen Link erstellen" : "Abo-Link erstellen"}
        </Button>
        {hasToken && (
          <Button type="submit" size="sm" variant="outline" name="intent" value="revoke" disabled={isPending}>
            Link widerrufen
          </Button>
        )}
      </form>
    </div>
  );
}
