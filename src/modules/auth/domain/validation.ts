import { z } from "zod";

/** Passwortregeln – identisch mit der Supabase-Auth-Konfiguration (min. 10 Zeichen, Buchstaben + Ziffern). */
export const PASSWORD_MIN_LENGTH = 10;

const email = z
  .string({ error: "Bitte gib deine E-Mail-Adresse ein." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }))
  .refine((value) => value.length <= 254, { error: "Die E-Mail-Adresse ist zu lang." });

const newPassword = z
  .string({ error: "Bitte gib ein Passwort ein." })
  .min(PASSWORD_MIN_LENGTH, { error: `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.` })
  .max(128, { error: "Das Passwort darf höchstens 128 Zeichen lang sein." })
  .refine((value) => /[A-Za-zÄÖÜäöüß]/.test(value) && /\d/.test(value), {
    error: "Das Passwort muss Buchstaben und Ziffern enthalten.",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Bitte gib dein Passwort ein." }).max(128),
});

export const signUpSchema = z.object({ email, password: newPassword });

export const passwordResetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, passwordConfirm: z.string() })
  .refine((data) => data.password === data.passwordConfirm, {
    error: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });

export type FieldErrors = Partial<Record<string, string>>;

/** Erste Fehlermeldung je Feld – passend für Formulare. */
export const fieldErrors = (error: z.ZodError): FieldErrors => {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
};

/** Supabase-Auth-Fehlercodes in verständliche Meldungen übersetzen (ohne Nutzer-Enumeration). */
export const authErrorMessage = (code: string | undefined): string => {
  switch (code) {
    case "invalid_credentials":
      return "E-Mail-Adresse oder Passwort ist falsch.";
    case "email_not_confirmed":
      return "Bitte bestätige zuerst deine E-Mail-Adresse. Den Link findest du in deinem Postfach.";
    case "weak_password":
      return "Dieses Passwort ist zu schwach. Bitte wähle ein längeres Passwort mit Buchstaben und Ziffern.";
    case "same_password":
      return "Das neue Passwort muss sich vom bisherigen unterscheiden.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.";
    case "session_not_found":
    case "session_expired":
      return "Deine Sitzung ist abgelaufen. Bitte fordere einen neuen Link an.";
    default:
      return "Das hat nicht geklappt. Bitte versuche es erneut.";
  }
};
