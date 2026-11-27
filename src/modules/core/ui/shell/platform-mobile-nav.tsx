"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/app/theme-toggle";
import type { PlatformNavGroup } from "../../config/navigation";
import { PlatformNav } from "./platform-nav";
import { TenantSwitcher, type TenantOption } from "./tenant-switcher";

export function PlatformMobileNav({
  groups,
  tenants,
  currentSlug,
  search,
  userMenu,
}: {
  groups: PlatformNavGroup[];
  tenants: TenantOption[];
  currentSlug: string;
  search: React.ReactNode;
  userMenu: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Navigation öffnen">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-3">
        <SheetHeader className="p-1 pb-3">
          <SheetTitle className="text-sm">NOVA</SheetTitle>
          <SheetDescription className="sr-only">Navigation und Unternehmensauswahl</SheetDescription>
        </SheetHeader>
        <TenantSwitcher tenants={tenants} currentSlug={currentSlug} />
        <div className="mt-3 flex">{search}</div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <PlatformNav groups={groups} onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <ThemeToggle />
          {userMenu}
        </div>
      </SheetContent>
    </Sheet>
  );
}
