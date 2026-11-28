"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { useFormAction } from "@/components/app/use-form-action";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "@/modules/core/server/action-state";
import { ActionButton, Textarea } from "@/modules/projects/ui/project-forms";
import { WEEKDAYS } from "@/modules/calendar/domain/calendar";
import { EMPLOYMENT_LABELS, EMPLOYMENT_TYPES, SALARY_PERIOD_LABELS } from "../domain/hr";
import {
  absenceDecisionAction,
  absenceTypeAction,
  adjustmentAction,
  deleteEmployeeAction,
  holidayAction,
  onboardingAction,
  requestAbsenceAction,
  saveEmployeeAction,
  savePrivateAction,
} from "../server/actions/hr-actions";

const IDLE: ActionState = { status: "idle" };
type Option = { id: string; label: string };
const decimal = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export type EmployeeFormValues = {
  id?: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  workPhone: string | null;
  position: string | null;
  departmentId: string | null;
  managerEmployeeId: string | null;
  memberId: string | null;
  employmentType: string;
  entryDate: string | null;
  exitDate: string | null;
  weeklyHours: number | null;
  workDays: number[];
  vacationDays: number;
};

export function EmployeeForm({
  tenantId,
  values,
  departments,
  managers,
  members,
}: {
  tenantId: string;
  values: EmployeeFormValues;
  departments: Option[];
  managers: Option[];
  members: Option[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveEmployeeAction, IDLE);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values.id && <input type="hidden" name="employeeId" value={values.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Vorname" name="first_name" defaultValue={values.firstName} required maxLength={100} error={errors.first_name} />
        <FormField label="Nachname" name="last_name" defaultValue={values.lastName} required maxLength={100} error={errors.last_name} />
        <FormField label="Position" name="position" defaultValue={values.position ?? ""} maxLength={120} error={errors.position} />
        <NativeSelect label="Abteilung" name="department_id" defaultValue={values.departmentId ?? ""} error={errors.department_id}>
          <option value="">– keine –</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Vorgesetzte Person" name="manager_employee_id" defaultValue={values.managerEmployeeId ?? ""} error={errors.manager_employee_id}>
          <option value="">– keine –</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="NOVA-Zugang" name="member_id" defaultValue={values.memberId ?? ""} error={errors.member_id}>
          <option value="">– ohne Zugang –</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Dienstliche E-Mail" name="work_email" type="email" defaultValue={values.workEmail ?? ""} error={errors.work_email} />
        <FormField label="Dienstliches Telefon" name="work_phone" defaultValue={values.workPhone ?? ""} maxLength={50} error={errors.work_phone} />
        <NativeSelect label="Beschäftigung" name="employment_type" defaultValue={values.employmentType} error={errors.employment_type}>
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EMPLOYMENT_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
        <FormField label="Wochenstunden" name="weekly_hours" inputMode="decimal" defaultValue={decimal(values.weeklyHours)} error={errors.weekly_hours} />
        <FormField label="Eintritt" name="entry_date" type="date" defaultValue={values.entryDate ?? ""} error={errors.entry_date} />
        <FormField label="Austritt" name="exit_date" type="date" defaultValue={values.exitDate ?? ""} error={errors.exit_date} />
        <FormField
          label="Urlaubstage pro Jahr"
          name="vacation_days"
          inputMode="decimal"
          defaultValue={decimal(values.vacationDays)}
          required
          hint="Im Eintritts- und Austrittsjahr anteilig."
          error={errors.vacation_days}
        />
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">Arbeitstage</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <input type="checkbox" name="work_days" value={day.value} defaultChecked={values.workDays.includes(day.value)} />
              <span aria-hidden>{day.short}</span>
              <span className="sr-only">{day.long}</span>
            </label>
          ))}
        </div>
        {errors.work_days && <p className="text-xs text-negative">{errors.work_days}</p>}
      </fieldset>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : values.id ? "Änderungen speichern" : "Mitarbeiter anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteEmployeeButton({ tenantId, employeeId, name }: { tenantId: string; employeeId: string; name: string }) {
  return (
    <ActionButton
      action={deleteEmployeeAction}
      fields={{ tenantId, employeeId }}
      confirm={`Personalakte von ${name} mit allen Abwesenheiten endgültig löschen? Für Ausgeschiedene besser ein Austrittsdatum setzen.`}
      className="text-negative hover:text-negative"
    >
      Endgültig löschen
    </ActionButton>
  );
}

export function PrivateForm({ tenantId, employeeId, values }: { tenantId: string; employeeId: string; values: Record<string, string | number | null> | null }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(savePrivateAction, IDLE);
  const errors = state.fieldErrors ?? {};
  const value = (key: string) => {
    const raw = values?.[key];
    if (raw === null || raw === undefined) return "";
    return typeof raw === "number" ? String(raw).replace(".", ",") : raw;
  };
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate autoComplete="off">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Geburtsdatum" name="birth_date" type="date" defaultValue={value("birth_date")} error={errors.birth_date} />
        <FormField label="Private E-Mail" name="private_email" type="email" defaultValue={value("private_email")} error={errors.private_email} />
        <FormField label="Private Telefonnummer" name="private_phone" defaultValue={value("private_phone")} error={errors.private_phone} />
        <FormField label="Straße" name="street" defaultValue={value("street")} error={errors.street} />
        <FormField label="PLZ" name="postal_code" defaultValue={value("postal_code")} error={errors.postal_code} />
        <FormField label="Ort" name="city" defaultValue={value("city")} error={errors.city} />
        <FormField label="Land (z. B. DE)" name="country_code" defaultValue={value("country_code")} maxLength={2} error={errors.country_code} />
        <FormField label="IBAN" name="iban" defaultValue={value("iban")} error={errors.iban} />
        <FormField label="BIC" name="bic" defaultValue={value("bic")} error={errors.bic} />
        <FormField label="Steuer-ID" name="tax_id" defaultValue={value("tax_id")} error={errors.tax_id} />
        <FormField label="Sozialversicherungsnummer" name="social_security_no" defaultValue={value("social_security_no")} error={errors.social_security_no} />
        <FormField label="Krankenkasse" name="health_insurance" defaultValue={value("health_insurance")} error={errors.health_insurance} />
        <FormField label="Vergütung (€)" name="salary_amount" inputMode="decimal" defaultValue={value("salary_amount")} error={errors.salary_amount} />
        <NativeSelect label="Vergütung je" name="salary_period" defaultValue={value("salary_period")} error={errors.salary_period}>
          <option value="">–</option>
          {Object.entries(SALARY_PERIOD_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <FormField label="Notfallkontakt" name="emergency_contact" defaultValue={value("emergency_contact")} maxLength={300} error={errors.emergency_contact} />
      <Textarea label="Vertrauliche Notizen" name="notes" defaultValue={value("notes") || null} maxLength={5000} rows={3} error={errors.notes} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : "Vertrauliche Daten speichern"}
        </Button>
      </div>
    </form>
  );
}

export function AbsenceRequestForm({
  tenantId,
  employees,
  types,
  defaultEmployeeId,
}: {
  tenantId: string;
  employees: Option[];
  types: Option[];
  defaultEmployeeId: string;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(requestAbsenceAction, IDLE, { resetOnSuccess: true });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <FormMessage status={state.status} message={state.message} />
      {employees.length > 1 ? (
        <NativeSelect label="Für" name="employee_id" defaultValue={defaultEmployeeId} error={errors.employee_id}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.label}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <input type="hidden" name="employee_id" value={defaultEmployeeId} />
      )}
      <NativeSelect label="Art" name="type_id" defaultValue={types[0]?.id ?? ""} error={errors.type_id}>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </NativeSelect>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Von" name="start_date" type="date" required error={errors.start_date} />
        <FormField label="Bis" name="end_date" type="date" required error={errors.end_date} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="half_day_start" value="1" />
          Erster Tag halb
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="half_day_end" value="1" />
          Letzter Tag halb
        </label>
      </div>
      <FormField label="Notiz" name="note" maxLength={1000} error={errors.note} />
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Wird gesendet …" : "Beantragen"}
        </Button>
      </div>
    </form>
  );
}

export function AbsenceButtons({ tenantId, absenceId, canDecide, canCancel }: { tenantId: string; absenceId: string; canDecide: boolean; canCancel: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {canDecide && (
        <>
          <ActionButton action={absenceDecisionAction} fields={{ tenantId, absenceId, intent: "approve" }} variant="default">
            Genehmigen
          </ActionButton>
          <ActionButton action={absenceDecisionAction} fields={{ tenantId, absenceId, intent: "reject" }} variant="outline" confirm="Antrag ablehnen?">
            Ablehnen
          </ActionButton>
        </>
      )}
      {canCancel && (
        <ActionButton action={absenceDecisionAction} fields={{ tenantId, absenceId, intent: "cancel" }} confirm="Abwesenheit zurückziehen?">
          Zurückziehen
        </ActionButton>
      )}
    </span>
  );
}

export function AdjustmentForm({ tenantId, employeeId, year }: { tenantId: string; employeeId: string; year: number }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(adjustmentAction, IDLE, { resetOnSuccess: true });
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="year" value={year} />
      <div className="w-28">
        <FormField label="Tage (±)" name="days" placeholder="z. B. 2,5" error={errors.days} />
      </div>
      <div className="min-w-40 flex-1">
        <FormField label="Grund" name="reason" placeholder="z. B. Übertrag aus Vorjahr" maxLength={200} error={errors.reason} />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        Korrektur eintragen
      </Button>
      {state.status === "error" && state.message && <p className="basis-full text-xs text-negative">{state.message}</p>}
    </form>
  );
}

export function DeleteAdjustmentButton({ tenantId, employeeId, adjustmentId }: { tenantId: string; employeeId: string; adjustmentId: string }) {
  return (
    <ActionButton action={adjustmentAction} fields={{ tenantId, employeeId, adjustmentId, intent: "delete" }} label="Korrektur löschen" className="text-muted-foreground">
      <Trash2 className="size-3.5" aria-hidden />
    </ActionButton>
  );
}

export function AbsenceTypeForm({
  tenantId,
  values,
}: {
  tenantId: string;
  values?: { id: string; name: string; color: string; deductsVacation: boolean; requiresApproval: boolean; isSick: boolean };
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(absenceTypeAction, IDLE, { resetOnSuccess: !values });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate aria-label={values ? `Art ${values.name}` : "Neue Art"}>
      <input type="hidden" name="tenantId" value={tenantId} />
      {values && <input type="hidden" name="typeId" value={values.id} />}
      <div className="min-w-36 flex-1">
        <FormField label={values ? "Name" : "Neue Art"} name="name" defaultValue={values?.name} maxLength={60} error={state.fieldErrors?.name} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Farbe
        <input type="color" name="color" defaultValue={values?.color ?? "#0ea5e9"} className="h-9 w-12 rounded border" />
      </label>
      <label className="flex h-9 items-center gap-1.5 text-sm">
        <input type="checkbox" name="deducts_vacation" value="1" defaultChecked={values?.deductsVacation ?? false} /> Zählt als Urlaub
      </label>
      <label className="flex h-9 items-center gap-1.5 text-sm">
        <input type="checkbox" name="requires_approval" value="1" defaultChecked={values?.requiresApproval ?? true} /> Genehmigung nötig
      </label>
      <label className="flex h-9 items-center gap-1.5 text-sm">
        <input type="checkbox" name="is_sick" value="1" defaultChecked={values?.isSick ?? false} /> Krankheit (vertraulich)
      </label>
      <Button type="submit" size="sm" variant={values ? "outline" : "default"} disabled={isPending}>
        {values ? "Speichern" : "Hinzufügen"}
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function ArchiveTypeButton({ tenantId, typeId, archived }: { tenantId: string; typeId: string; archived: boolean }) {
  return (
    <ActionButton action={absenceTypeAction} fields={{ tenantId, typeId, intent: archived ? "restore" : "archive" }}>
      {archived ? "Wieder aktivieren" : "Ausblenden"}
    </ActionButton>
  );
}

export function HolidayForm({ tenantId }: { tenantId: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(holidayAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <FormField label="Datum" name="date" type="date" error={state.fieldErrors?.date} />
      <div className="min-w-40 flex-1">
        <FormField label="Feiertag" name="name" placeholder="z. B. Tag der Deutschen Einheit" maxLength={80} error={state.fieldErrors?.name} />
      </div>
      <Button type="submit" size="sm" disabled={isPending}>
        Eintragen
      </Button>
      <div className="basis-full empty:hidden">
        <FormMessage status={state.status} message={state.message} />
      </div>
    </form>
  );
}

export function DeleteHolidayButton({ tenantId, date, name }: { tenantId: string; date: string; name: string }) {
  return (
    <ActionButton action={holidayAction} fields={{ tenantId, date, intent: "delete" }} label={`${name} entfernen`} className="text-muted-foreground">
      <Trash2 className="size-3.5" aria-hidden />
    </ActionButton>
  );
}

export function OnboardingList({
  tenantId,
  employeeId,
  tasks,
  members,
  canManage,
  memberNames,
}: {
  tenantId: string;
  employeeId: string;
  tasks: { id: string; title: string; dueDate: string | null; assigneeMemberId: string | null; done: boolean }[];
  members: Option[];
  canManage: boolean;
  memberNames: Record<string, string>;
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(onboardingAction, IDLE, { resetOnSuccess: true });
  return (
    <div className="flex flex-col gap-3">
      {tasks.length === 0 && <p className="text-sm text-muted-foreground">Keine Onboarding-Aufgaben.</p>}
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-sm">
            <ActionButton
              action={onboardingAction}
              fields={{ tenantId, employeeId, taskId: task.id, intent: "toggle", done: task.done ? "0" : "1" }}
              label={task.done ? `${task.title} wieder öffnen` : `${task.title} erledigen`}
              className="size-7 p-0"
            >
              <span aria-hidden className={`flex size-4 items-center justify-center rounded border text-[10px] ${task.done ? "border-positive bg-positive text-background" : "border-muted-foreground/60"}`}>
                {task.done ? "✓" : ""}
              </span>
            </ActionButton>
            <span className={`min-w-0 flex-1 ${task.done ? "text-muted-foreground line-through" : ""}`}>
              {task.title}
              <span className="text-xs text-muted-foreground">
                {task.dueDate && ` · bis ${task.dueDate.split("-").reverse().join(".")}`}
                {task.assigneeMemberId && ` · ${memberNames[task.assigneeMemberId] ?? ""}`}
              </span>
            </span>
            {canManage && (
              <ActionButton action={onboardingAction} fields={{ tenantId, employeeId, taskId: task.id, intent: "delete" }} label={`${task.title} entfernen`} className="text-muted-foreground">
                <Trash2 className="size-3.5" aria-hidden />
              </ActionButton>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2" noValidate>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="intent" value="add" />
          <div className="min-w-40 flex-1">
            <FormField label="Neue Aufgabe" name="title" placeholder="z. B. Laptop bereitstellen" maxLength={200} error={state.fieldErrors?.title} />
          </div>
          <FormField label="Bis" name="due_date" type="date" />
          <NativeSelect label="Zuständig" name="assignee_member_id" defaultValue="">
            <option value="">– niemand –</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            Hinzufügen
          </Button>
        </form>
      )}
    </div>
  );
}
