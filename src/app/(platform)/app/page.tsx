import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { listMyTenants } from "@/modules/core/server/tenants";

/**
 * Einstieg nach der Anmeldung: zum gewünschten (?unternehmen=<id>) oder ersten eigenen
 * Unternehmen, ohne Unternehmen zur Einrichtung.
 */
async function TenantRedirect({ searchParams }: Pick<PageProps<"/app">, "searchParams">) {
  await requireUser("/app");
  const [tenants, params] = await Promise.all([listMyTenants(), searchParams]);
  if (tenants.length === 0) redirect("/onboarding");
  const wanted = typeof params.unternehmen === "string" ? tenants.find((tenant) => tenant.id === params.unternehmen) : undefined;
  redirect(`/app/${encodeURIComponent((wanted ?? tenants[0]).slug)}`);
  return null;
}

export default function AppIndexPage({ searchParams }: PageProps<"/app">) {
  return (
    <Suspense fallback={null}>
      <TenantRedirect searchParams={searchParams} />
    </Suspense>
  );
}
