import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Projekte", template: "%s · Projekte · NOVA" } };

export default function ProjectsLayout({ children }: LayoutProps<"/app/[tenant]/projekte">) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">{children}</div>;
}
