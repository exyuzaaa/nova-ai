import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Kalender", template: "%s · Kalender · NOVA" } };

export default function CalendarLayout({ children }: LayoutProps<"/app/[tenant]/kalender">) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">{children}</div>;
}
