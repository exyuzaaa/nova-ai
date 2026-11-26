import type { Metadata } from "next";
import { PasswordResetRequestForm } from "@/modules/auth/ui/password-forms";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function PasswordResetRequestPage() {
  return <PasswordResetRequestForm />;
}
