import { Suspense } from "react";
import type { Metadata } from "next";
import { SignUpForm } from "@/modules/auth/ui/sign-up-form";

export const metadata: Metadata = { title: "Konto erstellen" };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
