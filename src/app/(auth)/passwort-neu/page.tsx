import type { Metadata } from "next";
import { NewPasswordForm } from "@/modules/auth/ui/password-forms";

export const metadata: Metadata = { title: "Neues Passwort" };

/** Erreichbar nur mit Sitzung (proxy.ts); normalerweise über den Link aus der E-Mail. */
export default function NewPasswordPage() {
  return <NewPasswordForm />;
}
