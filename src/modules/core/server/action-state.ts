import "server-only";
import type { FieldErrors } from "@/modules/auth/domain/validation";

/** Ergebnis einer Server Action für Formulare (useActionState). */
export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Einmalig angezeigter Einladungslink. */
  invitationLink?: string;
};

export const formValue = (formData: FormData, key: string): string => {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
};

export const failure = (message: string): ActionState => ({ status: "error", message });

export const GENERIC_ERROR = "Das hat nicht geklappt. Bitte versuche es erneut.";
export const FORBIDDEN = "Dafür fehlt dir die Berechtigung.";

/** Datenbankfehler in Meldungen übersetzen, ohne interne Details preiszugeben. */
export const databaseMessage = (error: { code?: string; message?: string } | null): string => {
  switch (error?.code) {
    case "42501":
      return FORBIDDEN;
    case "23505":
      return error.message?.includes("Mitglied") ? "Diese Person ist bereits Mitglied." : "Dieser Eintrag existiert bereits.";
    case "P0001":
      return error.message ?? GENERIC_ERROR;
    case "P0002":
      return "Die Einladung ist ungültig oder abgelaufen.";
    default:
      return GENERIC_ERROR;
  }
};
