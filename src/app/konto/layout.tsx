import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";

export const metadata: Metadata = { title: { default: "Konto", template: "%s · Konto · NOVA" } };

/** Persönliche Einstellungen (gelten für alle Unternehmen der Person). */
export default function AccountLayout({ children }: LayoutProps<"/konto">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <header className="flex h-12 items-center gap-3 border-b px-4">
        <Link href="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Zurück zu NOVA
        </Link>
        <span className="flex-1" />
        <div className="w-48">
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
