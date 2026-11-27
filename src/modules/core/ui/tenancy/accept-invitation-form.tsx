"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/modules/auth/ui/form-field";
import { acceptInvitationAction } from "@/modules/core/server/actions/tenant-actions";
import type { ActionState } from "@/modules/core/server/action-state";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(acceptInvitationAction, {
    status: "idle",
  });
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage status={state.status} message={state.message} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angenommen …" : "Einladung annehmen"}
      </Button>
    </form>
  );
}
