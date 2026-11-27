"use client";

import { useId } from "react";
import { useFormAction } from "@/components/app/use-form-action";
import { Button } from "@/components/ui/button";
import { FormField, FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "../../server/action-state";
import {
  createRoleAction,
  deleteRoleAction,
  setMemberRolesAction,
  updateRolePermissionsAction,
} from "../../server/actions/admin-actions";

const IDLE: ActionState = { status: "idle" };

export type GrantablePermission = { key: string; name: string; description: string | null; moduleName: string; allowed: boolean };

function PermissionChecklist({ permissions, selected }: { permissions: GrantablePermission[]; selected?: readonly string[] }) {
  const groups = new Map<string, GrantablePermission[]>();
  for (const permission of permissions) groups.set(permission.moduleName, [...(groups.get(permission.moduleName) ?? []), permission]);
  const chosen = new Set(selected ?? []);
  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups, ([moduleName, entries]) => (
        <fieldset key={moduleName} className="flex flex-col gap-2">
          <legend className="text-xs font-medium text-muted-foreground">{moduleName}</legend>
          {entries.map((permission) => (
            <label key={permission.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="permissions"
                value={permission.key}
                defaultChecked={chosen.has(permission.key)}
                disabled={!permission.allowed}
                className="mt-0.5 size-4 accent-[var(--brand)]"
              />
              <span className="flex flex-col">
                <span className={permission.allowed ? undefined : "text-muted-foreground"}>{permission.name}</span>
                {permission.description && <span className="text-xs text-muted-foreground">{permission.description}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export function CreateRoleForm({ tenantId, permissions }: { tenantId: string; permissions: GrantablePermission[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(createRoleAction, IDLE, { resetOnSuccess: true });
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tenantId" value={tenantId} />
      <FormMessage status={state.status} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name der Rolle" name="name" required maxLength={80} placeholder="z. B. Teamleitung" error={state.fieldErrors?.name} />
        <FormField label="Beschreibung (optional)" name="description" maxLength={300} error={state.fieldErrors?.description} />
      </div>
      <PermissionChecklist permissions={permissions} />
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Wird angelegt …" : "Rolle anlegen"}
        </Button>
      </div>
    </form>
  );
}

export function RoleEditor({
  tenantId,
  role,
  permissions,
}: {
  tenantId: string;
  role: { id: string; name: string; permissions: string[] };
  permissions: GrantablePermission[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(updateRolePermissionsAction, IDLE);
  const {
    state: deleteState,
    isPending: deleting,
    formRef: deleteRef,
    onSubmit: onDelete,
  } = useFormAction(deleteRoleAction, IDLE);
  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="roleId" value={role.id} />
        <FormMessage status={state.status} message={state.message} />
        <PermissionChecklist permissions={permissions} selected={role.permissions} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" size="sm" disabled={isPending} aria-label={`Rechte der Rolle ${role.name} speichern`}>
            {isPending ? "Wird gespeichert …" : "Rechte speichern"}
          </Button>
        </div>
      </form>
      <form
        ref={deleteRef}
        onSubmit={(event) => {
          if (window.confirm(`Rolle „${role.name}“ wirklich löschen? Mitglieder verlieren die zusätzlichen Rechte.`)) onDelete(event);
          else event.preventDefault();
        }}
      >
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="roleId" value={role.id} />
        <FormMessage status={deleteState.status} message={deleteState.message} />
        <Button type="submit" variant="ghost" size="sm" disabled={deleting} className="text-negative hover:text-negative">
          Rolle löschen
        </Button>
      </form>
    </div>
  );
}

export function MemberRolesForm({
  tenantId,
  memberId,
  memberLabel,
  roles,
  assigned,
}: {
  tenantId: string;
  memberId: string;
  memberLabel: string;
  roles: { id: string; name: string }[];
  assigned: string[];
}) {
  const { state, isPending, formRef, onSubmit } = useFormAction(setMemberRolesAction, IDLE);
  const id = useId();
  const chosen = new Set(assigned);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="sr-only">
        Zusätzliche Rollen von {memberLabel}
      </span>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {roles.map((role) => (
          <label key={role.id} className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="roleIds" value={role.id} defaultChecked={chosen.has(role.id)} className="size-4 accent-[var(--brand)]" />
            {role.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={isPending} aria-label={`Rollen von ${memberLabel} speichern`}>
          Speichern
        </Button>
        {state.message && (
          <span role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-xs text-negative" : "text-xs text-positive"}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
