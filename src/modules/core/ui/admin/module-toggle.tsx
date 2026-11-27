"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "../../server/action-state";
import { setModuleEnabledAction } from "../../server/actions/admin-actions";

const IDLE: ActionState = { status: "idle" };

export function ModuleToggle({ tenantId, moduleKey, moduleName, enabled }: { tenantId: string; moduleKey: string; moduleName: string; enabled: boolean }) {
  const [state, formAction, isPending] = useActionState(setModuleEnabledAction, IDLE);
  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (enabled && !window.confirm(`${moduleName} ausschalten? Die Daten bleiben erhalten, sind aber bis zum Wiedereinschalten nicht nutzbar.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="module" value={moduleKey} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <Button type="submit" size="sm" variant={enabled ? "outline" : "default"} disabled={isPending} aria-label={`${moduleName} ${enabled ? "ausschalten" : "einschalten"}`}>
        {isPending ? "…" : enabled ? "Ausschalten" : "Einschalten"}
      </Button>
      {state.status === "error" && (
        <span role="alert" className="text-xs text-negative">
          {state.message}
        </span>
      )}
    </form>
  );
}
