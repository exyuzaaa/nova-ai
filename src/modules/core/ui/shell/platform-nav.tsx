"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Blocks,
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  Network,
  Package,
  Receipt,
  ScrollText,
  UserRound,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavItemActive, type PlatformIcon, type PlatformNavGroup } from "../../config/navigation";

const ICONS: Record<PlatformIcon, LucideIcon> = {
  overview: LayoutDashboard,
  analytics: BarChart3,
  crm: Handshake,
  projects: FolderKanban,
  calendar: CalendarDays,
  hr: UserRound,
  finance: Receipt,
  documents: FileText,
  messaging: MessagesSquare,
  support: LifeBuoy,
  inventory: Package,
  marketing: Megaphone,
  automation: Workflow,
  company: Building2,
  members: Users,
  roles: KeyRound,
  departments: Network,
  modules: Blocks,
  audit: ScrollText,
};

export function PlatformNav({ groups, onNavigate }: { groups: PlatformNavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground/80 transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  active && "bg-sidebar-accent font-medium text-sidebar-foreground",
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
