"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "../domain/validation";
import { requestPasswordResetAction, updatePasswordAction, type AuthFormState } from "../server/actions";
import { FormField, FormMessage } from "./form-field";

export function PasswordResetRequestForm() {
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(requestPasswordResetAction, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Passwort vergessen</h1>
        <p className="text-sm text-muted-foreground">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      {state.status !== "success" && (
        <>
          <FormField
            label="E-Mail-Adresse"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            error={state.fieldErrors?.email}
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Wird gesendet …" : "Link senden"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Zurück zur Anmeldung
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(updatePasswordAction, {
    status: "idle",
  });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Neues Passwort festlegen</h1>
        <p className="text-sm text-muted-foreground">Danach bist du direkt angemeldet.</p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <FormField
        label="Neues Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen mit Buchstaben und Ziffern.`}
        error={state.fieldErrors?.password}
      />
      <FormField
        label="Passwort wiederholen"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird gespeichert …" : "Passwort speichern"}
      </Button>
    </form>
  );
}
