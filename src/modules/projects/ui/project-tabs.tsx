"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Unternavigation eines Projekts. */
export function ProjectTabs({ base, tabs }: { base: string; tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Projektbereiche" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b px-1">
        {tabs.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.exact ? pathname === href || pathname.startsWith(`${href}/aufgaben/`) : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-9 items-center border-b-2 px-3 text-sm text-muted-foreground hover:text-foreground",
                  active ? "border-brand font-medium text-foreground" : "border-transparent",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
