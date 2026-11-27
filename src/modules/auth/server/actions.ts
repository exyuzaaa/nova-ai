"use server";

import { headers } from "next/headers";
import { needsSecondFactor } from "../domain/mfa";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "../domain/redirects";
import {
  authErrorMessage,
  fieldErrors,
  loginSchema,
  newPasswordSchema,
  passwordResetRequestSchema,
  signUpSchema,
  type FieldErrors,
} from "../domain/validation";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Eingaben zurückgeben, damit das Formular nach Fehlern nicht leer ist (nie Passwörter). */
  email?: string;
};

const formString = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Basis-URL für E-Mail-Links (APP_URL, sonst aus der Anfrage). */
const appOrigin = async (): Promise<string> => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  return `${list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
};

export async function signInAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), email: formString(formData, "email") };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: authErrorMessage(error.code), email: parsed.data.email };
  }
  const next = safeNextPath(formString(formData, "next"));
  // Mit eingerichtetem zweiten Faktor: erst den Code aus der App abfragen
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (needsSecondFactor(level)) redirect(`/login/bestaetigen?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function signUpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), email: formString(formData, "email") };
  }

  const supabase = await createSupabaseServerClient();
  const next = safeNextPath(formString(formData, "next"), "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { signup_next: next },
      emailRedirectTo: `${await appOrigin()}/auth/confirm?next=${encodeURIComponent("/onboarding")}`,
    },
  });
  if (error) {
    return { status: "error", message: authErrorMessage(error.code), email: parsed.data.email };
  }
  // Ohne E-Mail-Bestätigung (z. B. lokal abgeschaltet) ist die Sitzung sofort aktiv.
  if (data.session) redirect(next);

  // Gleiche Antwort für neue und bereits registrierte Adressen (keine Nutzer-Enumeration).
  return {
    status: "success",
    message: `Fast geschafft! Wir haben eine E-Mail an ${parsed.data.email} geschickt. Bitte bestätige darin deine Adresse.`,
    email: parsed.data.email,
  };
}

export async function requestPasswordResetAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = passwordResetRequestSchema.safeParse({ email: formString(formData, "email") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), email: formString(formData, "email") };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await appOrigin()}/auth/confirm?type=recovery&next=${encodeURIComponent("/passwort-neu")}`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { status: "error", message: authErrorMessage(error.code), email: parsed.data.email };
  }
  // Immer dieselbe Antwort – unabhängig davon, ob ein Konto existiert.
  return {
    status: "success",
    message: "Wenn ein Konto zu dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt.",
    email: parsed.data.email,
  };
}

export async function updatePasswordAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: formString(formData, "password"),
    passwordConfirm: formString(formData, "passwordConfirm"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: "error", message: authErrorMessage("session_expired") };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: authErrorMessage(error.code) };
  redirect("/analytics?hinweis=passwort-geaendert");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?hinweis=abgemeldet");
}
