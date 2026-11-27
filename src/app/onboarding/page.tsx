import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole } from "@/modules/core/domain/roles";
import { listMyTenants } from "@/modules/core/server/tenants";
import { isDemoEnabled, listOwnSites } from "@/modules/analytics/server/sites";
import { CreateTenantForm, CreateWebsiteForm } from "@/modules/analytics/ui/tenancy/onboarding-forms";
import { requireUser } from "@/modules/auth/server/session";

export const metadata: Metadata = { title: "Einrichtung" };

async function OnboardingStep({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  await requireUser("/onboarding");
  const query = await searchParams;
  const wantsNewWebsite = query.neu === "website";
  const wantsNewTenant = query.neu === "unternehmen";
  const [tenants, sites] = await Promise.all([listMyTenants(), listOwnSites()]);

  if (tenants.length === 0 || wantsNewTenant) return <CreateTenantForm />;
  if (sites.length > 0 && !wantsNewWebsite) redirect(`/analytics/${sites[0].id}`);

  const adminTenants = tenants.filter((tenant) => hasRole(tenant.role, "admin"));
  if (adminTenants.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Noch keine Website freigegeben</h1>
        <p className="text-sm text-muted-foreground">
          Du bist Mitglied, aber in deinem Unternehmen gibt es noch keine Website oder du darfst keine anlegen. Bitte
          wende dich an einen Administrator.
        </p>
        <Link href="/app" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Zur Übersicht deines Unternehmens
        </Link>
      </div>
    );
  }
  return (
    <CreateWebsiteForm
      tenants={adminTenants.map(({ id, name }) => ({ id, name }))}
      isFirst={sites.length === 0}
    />
  );
}

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xs">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Wird geladen …</p>}>
          <OnboardingStep searchParams={searchParams} />
        </Suspense>
      </div>
      {isDemoEnabled() && (
        <Link href="/analytics/demo" className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline">
          Erst einmal die Demo ansehen
        </Link>
      )}
    </main>
  );
}
