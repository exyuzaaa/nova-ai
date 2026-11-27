"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/app/copy-button";
import { useFormAction } from "@/components/app/use-form-action";
import {
  confirmTotpAction,
  enrollTotpAction,
  removeFactorAction,
  revokeSessionAction,
  signOutOtherSessionsAction,
  verifyLoginCodeAction,
  type SecurityActionState,
} from "../server/security-actions";
import { FormField, FormMessage } from "./form-field";

const IDLE: SecurityActionState = { status: "idle" };

const CodeField = ({ error }: { error?: string }) => (
  <FormField
    label="Code aus der App"
    name="code"
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9 ]*"
    maxLength={7}
    required
    error={error}
  />
);

/** Anmeldung mit dem Code aus der Authenticator-App bestätigen. */
export function VerifyLoginForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, formAction, isPending] = useActionState(verifyLoginCodeAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Anmeldung bestätigen</h1>
        <p className="text-sm text-muted-foreground">
          Öffne deine Authenticator-App und gib den aktuellen sechsstelligen Code für NOVA ein.
        </p>
      </div>
      <FormMessage status={state.status} message={state.message} />
      <input type="hidden" name="next" value={next} />
      <CodeField error={state.fieldErrors?.code} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Wird geprüft …" : "Bestätigen"}
      </Button>
    </form>
  );
}

/** Zwei-Faktor einrichten: Schritt 1 Name → QR-Code, Schritt 2 Code bestätigen. */
export function EnrollTotpForm() {
  const [enrollState, enrollAction, enrolling] = useActionState(enrollTotpAction, IDLE);
  const [confirmState, confirmAction, confirming] = useActionState(confirmTotpAction, IDLE);
  const enrollment = enrollState.enrollment;

  if (confirmState.status === "success") return <FormMessage status="success" message={confirmState.message} />;

  if (!enrollment) {
    return (
      <form action={enrollAction} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <div className="flex-1">
          <FormField
            label="Name des Geräts (optional)"
            name="name"
            maxLength={60}
            placeholder="z. B. Mein iPhone"
            error={enrollState.fieldErrors?.name}
          />
        </div>
        <Button type="submit" disabled={enrolling} className="sm:mt-[22px]">
          {enrolling ? "Wird vorbereitet …" : "Zwei-Faktor einrichten"}
        </Button>
        <FormMessage status={enrollState.status} message={enrollState.message} />
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Öffne eine Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, 1Password).</li>
        <li>Scanne den QR-Code oder gib den Schlüssel von Hand ein.</li>
        <li>Gib den sechsstelligen Code ein, den die App anzeigt.</li>
      </ol>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* QR-Code kommt von Supabase als SVG-data:-URL */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="QR-Code für die Authenticator-App" className="size-44 rounded-lg border bg-white p-2" />
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs text-muted-foreground">Schlüssel zum Abtippen</span>
          <code className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm break-all" data-testid="totp-secret">
            {enrollment.secret}
          </code>
          <CopyButton value={enrollment.secret} label="Schlüssel kopieren" />
        </div>
      </div>
      <form action={confirmAction} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
        <input type="hidden" name="factorId" value={enrollment.factorId} />
        <div className="flex-1 sm:max-w-xs">
          <CodeField error={confirmState.fieldErrors?.code} />
        </div>
        <Button type="submit" disabled={confirming} className="sm:mt-[22px]">
          {confirming ? "Wird geprüft …" : "Code bestätigen"}
        </Button>
      </form>
      <FormMessage status={confirmState.status} message={confirmState.message} />
    </div>
  );
}

export function RemoveFactorButton({ factorId, name }: { factorId: string; name: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(removeFactorAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm(`„${name}“ entfernen? Danach meldest du dich nur noch mit dem Passwort an.`)) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="factorId" value={factorId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="text-negative hover:text-negative" aria-label={`${name} entfernen`}>
        Entfernen
      </Button>
      {state.status === "error" && (
        <span role="alert" className="text-xs text-negative">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function RevokeSessionButton({ sessionId, label }: { sessionId: string; label: string }) {
  const { state, isPending, formRef, onSubmit } = useFormAction(revokeSessionAction, IDLE);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="sessionId" value={sessionId} />
      <Button type="submit" variant="ghost" size="sm" disabled={isPending} aria-label={`${label} abmelden`}>
        Abmelden
      </Button>
      {state.status === "error" && (
        <span role="alert" className="text-xs text-negative">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function SignOutOthersButton() {
  const { state, isPending, formRef, onSubmit } = useFormAction(signOutOtherSessionsAction, IDLE);
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (window.confirm("Alle anderen Geräte abmelden?")) onSubmit(event);
        else event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <FormMessage status={state.status} message={state.message} />
      <div>
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          Alle anderen Geräte abmelden
        </Button>
      </div>
    </form>
  );
}
