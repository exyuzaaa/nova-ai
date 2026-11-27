"use client";

import { useFormAction } from "@/components/app/use-form-action";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "../../server/action-state";
import {
  deleteOrganizationUnitAction,
  saveDepartmentAction,
  saveTeamAction,
  setTeamMembersAction,
} from "../../server/actions/admin-actions";

const IDLE: ActionState = { status: "idle" };

type Option = { id: string; label: string };

export function DepartmentForm({
  tenantId,
  departments,
  members,
  department,
}: {
  tenantId: string;
  departments: Option[];
  members: Option[];
  department?: { id: string; name: string; description: string | null; parentId: string | null; leadMemberId: string | null };
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveDepartmentAction, IDLE, { resetOnSuccess: !department });
  const parents = departments.filter((entry) => entry.id !== department?.id);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {department && <input type="hidden" name="departmentId" value={department.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" name="name" defaultValue={department?.name} required maxLength={120} error={state.fieldErrors?.name} />
        <FormField label="Beschreibung (optional)" name="description" defaultValue={department?.description ?? ""} maxLength={500} error={state.fieldErrors?.description} />
        <NativeSelect label="Übergeordnete Abteilung" name="parent_id" defaultValue={department?.parentId ?? ""} error={state.fieldErrors?.parent_id}>
          <option value="">Keine (oberste Ebene)</option>
          {parents.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Leitung" name="lead_member_id" defaultValue={department?.leadMemberId ?? ""} error={state.fieldErrors?.lead_member_id}>
          <option value="">Keine</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Button type="submit" size="sm" variant={department ? "outline" : "default"} disabled={isPending}>
          {isPending ? "Wird gespeichert …" : department ? "Abteilung speichern" : "Abteilung anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function TeamForm({
  tenantId,
  departments,
  members,
  team,
}: {
  tenantId: string;
  departments: Option[];
  members: Option[];
  team?: { id: string; name: string; description: string | null; departmentId: string | null; leadMemberId: string | null };
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveTeamAction, IDLE, { resetOnSuccess: !team });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      {team && <input type="hidden" name="teamId" value={team.id} />}
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" name="name" defaultValue={team?.name} required maxLength={120} error={state.fieldErrors?.name} />
        <FormField label="Beschreibung (optional)" name="description" defaultValue={team?.description ?? ""} maxLength={500} error={state.fieldErrors?.description} />
        <NativeSelect label="Abteilung" name="department_id" defaultValue={team?.departmentId ?? ""} error={state.fieldErrors?.department_id}>
          <option value="">Keine</option>
          {departments.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect label="Teamleitung" name="lead_member_id" defaultValue={team?.leadMemberId ?? ""} error={state.fieldErrors?.lead_member_id}>
          <option value="">Keine</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Button type="submit" size="sm" variant={team ? "outline" : "default"} disabled={isPending}>
          {isPending ? "Wird gespeichert …" : team ? "Team speichern" : "Team anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function TeamMembersForm({
  tenantId,
  teamId,
  teamName,
  members,
  selected,
}: {
  tenantId: string;
  teamId: string;
  teamName: string;
  members: Option[];
  selected: string[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(setTeamMembersAction, IDLE);
  const chosen = new Set(selected);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="teamId" value={teamId} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">Mitglieder von {teamName}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="memberIds" value={member.id} defaultChecked={chosen.has(member.id)} className="size-4 accent-[var(--brand)]" />
              {member.label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage status={state.status} message={state.message} />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending} aria-label={`Mitglieder von ${teamName} speichern`}>
          Mitglieder speichern
        </Button>
      </div>
    </form>
  );
}

export function DeleteUnitButton({ tenantId, kind, id, name }: { tenantId: string; kind: "department" | "team"; id: string; name: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(deleteOrganizationUnitAction, IDLE);
  const label = kind === "department" ? "Abteilung" : "Team";
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`${label} „${name}“ wirklich löschen?`)) onSubmit(event);
        else event.preventDefault();
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <FormMessage status={state.status} message={state.status === "error" ? state.message : undefined} />
      <Button type="submit" size="sm" variant="ghost" disabled={isPending} className="text-negative hover:text-negative" aria-label={`${label} ${name} löschen`}>
        Löschen
      </Button>
    </form>
  );
}
