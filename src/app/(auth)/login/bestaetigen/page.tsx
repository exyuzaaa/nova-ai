import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsSecondFactor } from "@/modules/auth/domain/mfa";
import { safeNextPath } from "@/modules/auth/domain/redirects";
import { requireUser } from "@/modules/auth/server/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VerifyLoginForm } from "@/modules/auth/ui/security-forms";

export const metadata: Metadata = { title: "Anmeldung bestätigen" };

/** Nur nötig, wenn ein zweiter Faktor eingerichtet und die Sitzung noch nicht bestätigt ist. */
async function SecondFactorStep({ searchParams }: Pick<PageProps<"/login/bestaetigen">, "searchParams">) {
  const [query] = await Promise.all([searchParams, requireUser("/login")]);
  const next = safeNextPath(typeof query.next === "string" ? query.next : undefined);
  const { data: level } = await (await createSupabaseServerClient()).auth.mfa.getAuthenticatorAssuranceLevel();
  if (!needsSecondFactor(level)) redirect(next);
  return <VerifyLoginForm />;
}

export default function SecondFactorPage({ searchParams }: PageProps<"/login/bestaetigen">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Wird geladen …</p>}>
      <SecondFactorStep searchParams={searchParams} />
    </Suspense>
  );
}
