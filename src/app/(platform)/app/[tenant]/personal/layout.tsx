import { Suspense } from "react";
import type { Metadata } from "next";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { HrTabs } from "@/modules/hr/ui/hr-tabs";

export const metadata: Metadata = { title: { default: "Personal", template: "%s · Personal · NOVA" } };

async function Tabs({ slug }: { slug: string }) {
  const { tenant, permissions } = await requireTenantContext(slug, "hr.view");
  return (
    <HrTabs
      base={`${tenantBasePath(tenant.slug)}/personal`}
      tabs={[
        { href: "", label: "Mitarbeiter", exact: true },
        { href: "/abwesenheiten", label: "Abwesenheiten" },
        ...(permissions.has("hr.manage") ? [{ href: "/einstellungen", label: "Einstellungen" }] : []),
      ]}
    />
  );
}

export default function HrLayout({ children, params }: LayoutProps<"/app/[tenant]/personal">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Suspense fallback={<div className="h-9 border-b" />}>{params.then(({ tenant }) => <Tabs slug={decodeURIComponent(tenant)} />)}</Suspense>
      {children}
    </div>
  );
}
