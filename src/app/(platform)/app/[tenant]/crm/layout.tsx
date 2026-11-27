import { Suspense } from "react";
import type { Metadata } from "next";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { CrmTabs } from "@/modules/crm/ui/crm-tabs";

export const metadata: Metadata = { title: { default: "CRM", template: "%s · CRM · NOVA" } };

async function Tabs({ slug }: { slug: string }) {
  // Ohne CRM-Recht oder bei ausgeschaltetem Modul gibt es den Bereich nicht (404)
  const { tenant } = await requireTenantContext(slug, "crm.view");
  return (
    <CrmTabs
      base={`${tenantBasePath(tenant.slug)}/crm`}
      tabs={[
        { href: "", label: "Übersicht", exact: true },
        { href: "/kunden", label: "Kunden" },
        { href: "/leads", label: "Leads" },
      ]}
    />
  );
}

export default function CrmLayout({ children, params }: LayoutProps<"/app/[tenant]/crm">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Suspense fallback={<div className="h-9 border-b" />}>
        {params.then(({ tenant }) => <Tabs slug={decodeURIComponent(tenant)} />)}
      </Suspense>
      {children}
    </div>
  );
}
