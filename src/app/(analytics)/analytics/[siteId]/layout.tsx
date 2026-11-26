import { AppShell } from "@/modules/analytics/ui/shell/app-shell";

export default function SiteLayout({ children, params }: LayoutProps<"/analytics/[siteId]">) {
  return <AppShell siteId={params.then(({ siteId }) => siteId)}>{children}</AppShell>;
}
