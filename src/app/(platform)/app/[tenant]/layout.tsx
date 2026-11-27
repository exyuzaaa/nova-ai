import type { Metadata } from "next";
import { PlatformShell } from "@/modules/core/ui/shell/platform-shell";

export const metadata: Metadata = { title: { default: "NOVA", template: "%s · NOVA" } };

export default function TenantLayout({ children, params }: LayoutProps<"/app/[tenant]">) {
  return <PlatformShell slug={params.then(({ tenant }) => decodeURIComponent(tenant))}>{children}</PlatformShell>;
}
