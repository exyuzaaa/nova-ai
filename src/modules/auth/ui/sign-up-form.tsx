"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "../domain/validation";
import { signUpAction, type AuthFormState } from "../server/actions";
import { FormField, FormMessage } from "./form-field";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(signUpAction, {
    status: "idle",
    email: searchParams.get("email") ?? undefined,
  });

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Postfach prüfen</h1>
        <FormMessage status="success" message={state.message} />
        <p className="text-sm text-muted-foreground">
          Keine E-Mail erhalten? Prüfe den Spam-Ordner oder registriere dich nach einigen Minuten erneut.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Konto erstellen</h1>
        <p className="text-sm text-muted-foreground">Nach der Registrierung bestätigst du deine E-Mail-Adresse.</p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <input type="hidden" name="next" value={next} />
      <FormField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={state.fieldErrors?.email}
      />
      <FormField
        label="Passwort"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen mit Buchstaben und Ziffern.`}
        error={state.fieldErrors?.password}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird erstellt …" : "Konto erstellen"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Bereits registriert?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-brand underline-offset-4 hover:underline"
        >
          Anmelden
        </Link>
      </p>
    </form>
  );
}
