"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { SiteSwitcher, type SiteOption } from "./site-switcher";
import { ThemeToggle } from "./theme-toggle";

export function MobileNav({
  siteId,
  isDemo,
  sites,
  canAddWebsite,
  userMenu,
}: {
  siteId: string;
  isDemo: boolean;
  sites: SiteOption[];
  canAddWebsite: boolean;
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
          <SheetTitle className="text-sm">NOVA Analytics</SheetTitle>
          <SheetDescription className="sr-only">Navigation und Website-Auswahl</SheetDescription>
        </SheetHeader>
        <SiteSwitcher sites={sites} currentId={siteId} canAddWebsite={canAddWebsite} />
        <div className="mt-4 flex-1 overflow-y-auto">
          <SidebarNav siteId={siteId} isDemo={isDemo} onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <ThemeToggle />
          {userMenu}
        </div>
      </SheetContent>
    </Sheet>
  );
}
