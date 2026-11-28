import { Suspense } from "react";
import type { Metadata } from "next";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { FinanceTabs } from "@/modules/finance/ui/finance-tabs";

export const metadata: Metadata = { title: { default: "Finanzen", template: "%s · Finanzen · NOVA" } };

async function Tabs({ slug }: { slug: string }) {
  const { tenant, permissions } = await requireTenantContext(slug, "finance.view");
  return (
    <FinanceTabs
      base={`${tenantBasePath(tenant.slug)}/finanzen`}
      tabs={[
        { href: "", label: "Übersicht" },
        { href: "/rechnungen", label: "Rechnungen" },
        { href: "/angebote", label: "Angebote" },
        { href: "/gutschriften", label: "Gutschriften" },
        { href: "/artikel", label: "Artikel" },
        ...(permissions.has("finance.manage") ? [{ href: "/einstellungen", label: "Einstellungen" }] : []),
      ]}
    />
  );
}

export default function FinanceLayout({ children, params }: LayoutProps<"/app/[tenant]/finanzen">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <Suspense fallback={<div className="h-9 border-b" />}>{params.then(({ tenant }) => <Tabs slug={decodeURIComponent(tenant)} />)}</Suspense>
      {children}
    </div>
  );
}
