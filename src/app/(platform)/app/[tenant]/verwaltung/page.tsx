import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { getTenantProfile } from "@/modules/core/server/admin-data";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { ProfileForm } from "@/modules/core/ui/admin/profile-form";

export const metadata: Metadata = { title: "Unternehmen" };

async function Profile({ params }: Pick<PageProps<"/app/[tenant]/verwaltung">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "core.members.read");
  const profile = await getTenantProfile(tenant.id);
  if (!profile) notFound();
  const canEdit = permissions.has("core.settings.manage");

  return (
    <Section
      title="Unternehmensprofil"
      description={
        canEdit
          ? "Diese Angaben nutzt NOVA für Rechnungen, Angebote und E-Mails. Pflichtangaben auf Rechnungen sind Firmierung und Anschrift."
          : "Nur Administratoren können diese Angaben ändern."
      }
    >
      <ProfileForm
        canEdit={canEdit}
        values={{
          tenantId: profile.id,
          name: profile.name,
          legalName: profile.legalName,
          street: profile.street,
          postalCode: profile.postalCode,
          city: profile.city,
          countryCode: profile.countryCode,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          vatId: profile.vatId,
          industry: profile.industry,
          companySize: profile.companySize,
          locale: profile.locale,
          timezone: profile.timezone,
          currency: profile.currency,
        }}
      />
    </Section>
  );
}

export default function TenantProfilePage({ params }: PageProps<"/app/[tenant]/verwaltung">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Unternehmen" description="Profil, Anschrift, Kontakt und Region" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Profil wird geladen" />}>
        <Profile params={params} />
      </Suspense>
    </div>
  );
}
