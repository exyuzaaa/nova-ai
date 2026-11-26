"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signInAction, type AuthFormState } from "../server/actions";
import { FormField, FormMessage } from "./form-field";

const NOTICES: Record<string, string> = {
  abgemeldet: "Du wurdest abgemeldet.",
};
const ERRORS: Record<string, string> = {
  "link-ungueltig": "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(signInAction, {
    status: "idle",
    email: searchParams.get("email") ?? undefined,
  });
  const notice = NOTICES[searchParams.get("hinweis") ?? ""];
  const linkError = ERRORS[searchParams.get("fehler") ?? ""];
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Anmelden</h1>
        <p className="text-sm text-muted-foreground">Melde dich mit deiner E-Mail-Adresse an.</p>
      </div>
      {notice && state.status === "idle" && <FormMessage status="success" message={notice} />}
      {linkError && state.status === "idle" && <FormMessage status="error" message={linkError} />}
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
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird angemeldet …" : "Anmelden"}
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/passwort-vergessen" className="text-muted-foreground underline-offset-4 hover:underline">
          Passwort vergessen?
        </Link>
        <Link href={withNext("/registrieren")} className="font-medium text-brand underline-offset-4 hover:underline">
          Konto erstellen
        </Link>
      </div>
    </form>
  );
}
