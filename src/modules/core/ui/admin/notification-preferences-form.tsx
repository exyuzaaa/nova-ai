"use client";

import { Button } from "@/components/ui/button";
import { useFormAction } from "@/components/app/use-form-action";
import { FormMessage } from "@/modules/auth/ui/form-field";
import type { ActionState } from "../../server/action-state";
import { saveNotificationPreferencesAction } from "../../server/actions/notification-actions";

const IDLE: ActionState = { status: "idle" };

export type PreferenceRow = { kind: string; label: string; description: string; inApp: boolean; email: boolean };

export function NotificationPreferencesForm({ preferences }: { preferences: PreferenceRow[] }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(saveNotificationPreferencesAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormMessage status={state.status} message={state.message} />
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">Benachrichtigungen je Art</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="pb-2 text-left font-medium">Art</th>
              <th scope="col" className="w-24 pb-2 text-center font-medium">In NOVA</th>
              <th scope="col" className="w-24 pb-2 text-center font-medium">E-Mail</th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((preference) => (
              <tr key={preference.kind} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {preference.label}
                  <span className="block text-xs text-muted-foreground">{preference.description}</span>
                </th>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    name={`${preference.kind}:in_app`}
                    defaultChecked={preference.inApp}
                    aria-label={`${preference.label} in NOVA anzeigen`}
                    className="size-4 accent-[var(--brand)]"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    name={`${preference.kind}:email`}
                    defaultChecked={preference.email}
                    aria-label={`${preference.label} per E-Mail`}
                    className="size-4 accent-[var(--brand)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        E-Mail-Benachrichtigungen werden verschickt, sobald der E-Mail-Versand von NOVA eingerichtet ist. Deine Auswahl
        wird bereits gespeichert.
      </p>
      <div>
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? "Wird gespeichert …" : "Einstellungen speichern"}
        </Button>
      </div>
    </form>
  );
}
