"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { factorNameSchema, mfaErrorMessage, totpCodeSchema } from "../domain/mfa";
import { safeNextPath } from "../domain/redirects";
import { requireUser } from "./session";

export type SecurityActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Neue Einrichtung: QR-Code (SVG als data:-URL) und Schlüssel zum Abtippen. */
  enrollment?: { factorId: string; qrCode: string; secret: string };
};

const formValue = (formData: FormData, key: string): string => {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
};

// -----------------------------------------------------------------------------
// Zwei-Faktor einrichten
// -----------------------------------------------------------------------------
export async function enrollTotpAction(_state: SecurityActionState, formData: FormData): Promise<SecurityActionState> {
  await requireUser("/konto/sicherheit");
  const name = factorNameSchema.safeParse(formValue(formData, "name"));
  if (!name.success) return { status: "error", fieldErrors: { name: name.error.issues[0]?.message ?? "" } };

  const supabase = await createSupabaseServerClient();
  // Abgebrochene Einrichtungen (unbestätigte Faktoren) aufräumen
  const existing = await supabase.auth.mfa.listFactors();
  for (const factor of existing.data?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name.data, issuer: "NOVA" });
  if (error || !data) return { status: "error", message: mfaErrorMessage(error?.code) };
  return {
    status: "success",
    enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

export async function confirmTotpAction(state: SecurityActionState, formData: FormData): Promise<SecurityActionState> {
  await requireUser("/konto/sicherheit");
  const factorId = formValue(formData, "factorId");
  const code = totpCodeSchema.safeParse(formValue(formData, "code"));
  if (!uuidSchema.safeParse(factorId).success) return { status: "error", message: mfaErrorMessage(undefined) };
  if (!code.success) {
    return { ...state, status: "error", message: undefined, fieldErrors: { code: code.error.issues[0]?.message ?? "" } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { ...state, status: "error", message: mfaErrorMessage(error.code), fieldErrors: undefined };
  refresh();
  return { status: "success", message: "Zwei-Faktor-Anmeldung ist eingerichtet. Ab jetzt fragt NOVA beim Anmelden nach einem Code." };
}

export async function removeFactorAction(_state: SecurityActionState, formData: FormData): Promise<SecurityActionState> {
  await requireUser("/konto/sicherheit");
  const factorId = formValue(formData, "factorId");
  if (!uuidSchema.safeParse(factorId).success) return { status: "error", message: mfaErrorMessage(undefined) };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { status: "error", message: mfaErrorMessage(error.code) };
  // Die Sitzung neu laden, damit die Sicherheitsstufe stimmt
  await supabase.auth.refreshSession();
  refresh();
  return { status: "success", message: "Das Gerät wurde entfernt." };
}

// -----------------------------------------------------------------------------
// Anmeldung mit Code bestätigen
// -----------------------------------------------------------------------------
export async function verifyLoginCodeAction(state: SecurityActionState, formData: FormData): Promise<SecurityActionState> {
  await requireUser("/login/bestaetigen");
  const code = totpCodeSchema.safeParse(formValue(formData, "code"));
  if (!code.success) return { status: "error", fieldErrors: { code: code.error.issues[0]?.message ?? "" } };

  const supabase = await createSupabaseServerClient();
  const factors = await supabase.auth.mfa.listFactors();
  const factor = (factors.data?.totp ?? []).find((entry) => entry.status === "verified");
  if (!factor) redirect(safeNextPath(formValue(formData, "next")));

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) return { ...state, status: "error", message: mfaErrorMessage(error.code), fieldErrors: undefined };
  redirect(safeNextPath(formValue(formData, "next")));
}

// -----------------------------------------------------------------------------
// Geräte
// -----------------------------------------------------------------------------
export async function revokeSessionAction(_state: SecurityActionState, formData: FormData): Promise<SecurityActionState> {
  await requireUser("/konto/sicherheit");
  const sessionId = formValue(formData, "sessionId");
  if (!uuidSchema.safeParse(sessionId).success) return { status: "error", message: mfaErrorMessage(undefined) };
  const { data, error } = await coreSchema(await createSupabaseServerClient()).rpc("revoke_session", { p_session: sessionId });
  if (error) return { status: "error", message: error.code === "42501" ? mfaErrorMessage("insufficient_aal") : mfaErrorMessage(undefined) };
  if (!data) return { status: "error", message: "Dieses Gerät ist bereits abgemeldet." };
  refresh();
  return { status: "success", message: "Das Gerät wurde abgemeldet." };
}

export async function signOutOtherSessionsAction(): Promise<SecurityActionState> {
  await requireUser("/konto/sicherheit");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { status: "error", message: mfaErrorMessage(error.code) };
  refresh();
  return { status: "success", message: "Alle anderen Geräte wurden abgemeldet." };
}
