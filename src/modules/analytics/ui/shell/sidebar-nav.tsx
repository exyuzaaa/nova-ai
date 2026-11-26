"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Blocks,
  FileText,
  Filter,
  Globe2,
  LayoutDashboard,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  Radio,
  Route,
  Settings,
  Share2,
  ShieldCheck,
  Target,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navHref, visibleNavigation, type NavIcon } from "../../config/navigation";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  realtime: Radio,
  visitors: Users,
  pages: FileText,
  sources: Share2,
  locations: Globe2,
  devices: MonitorSmartphone,
  paths: Route,
  events: MousePointerClick,
  goals: Target,
  funnels: Filter,
  campaigns: Megaphone,
  leads: UserRoundCheck,
  reports: BarChart3,
  integrations: Blocks,
  privacy: ShieldCheck,
  settings: Settings,
};

export function SidebarNav({
  siteId,
  isDemo = false,
  onNavigate,
}: {
  siteId: string;
  isDemo?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = visibleNavigation(undefined, { isDemo });

  return (
    <nav aria-label="Analytics-Navigation" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
          {group.items.map((item) => {
            const href = navHref(siteId, item);
            const isActive = item.segment ? pathname.startsWith(href) : pathname === href;
            const Icon = ICONS[item.id];
            return (
              <Link
                key={item.id}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground/80 transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  isActive && "bg-sidebar-accent font-medium text-sidebar-foreground",
                )}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
