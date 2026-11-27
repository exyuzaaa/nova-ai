import { z } from "zod";

/** Sechsstelliger Code aus der Authenticator-App (Leerzeichen werden ignoriert). */
export const totpCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, { error: "Bitte gib den sechsstelligen Code aus deiner App ein." }));

export const factorNameSchema = z
  .string()
  .trim()
  .max(60, { error: "Der Name darf höchstens 60 Zeichen lang sein." })
  .transform((value) => value || "Authenticator-App");

/** Fehlermeldungen der Zwei-Faktor-Anmeldung. */
export const mfaErrorMessage = (code: string | undefined): string => {
  switch (code) {
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "Der Code ist falsch oder abgelaufen. Bitte gib den aktuellen Code aus deiner App ein.";
    case "mfa_factor_name_conflict":
      return "Diesen Namen hast du bereits für ein anderes Gerät verwendet.";
    case "insufficient_aal":
      return "Bitte bestätige zuerst deine Anmeldung mit einem Code aus deiner App.";
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return "Die Zwei-Faktor-Anmeldung ist für dieses System noch nicht freigeschaltet.";
    case "over_request_rate_limit":
      return "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.";
    default:
      return "Das hat nicht geklappt. Bitte versuche es erneut.";
  }
};

/**
 * Muss die Anmeldung mit einem zweiten Faktor bestätigt werden?
 * (Faktor eingerichtet = nächste Stufe aal2, aktuelle Sitzung noch aal1.)
 */
export const needsSecondFactor = (level: { currentLevel: string | null; nextLevel: string | null } | null | undefined): boolean =>
  Boolean(level && level.nextLevel === "aal2" && level.currentLevel !== "aal2");
