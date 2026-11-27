"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Glocke mit Zahl ungelesener Benachrichtigungen. Startwert kommt vom Server,
 * aktualisiert wird beim Seitenwechsel, beim Zurückkehren in den Tab und jede Minute.
 */
export function NotificationBell({ tenantId, href, initialUnread }: { tenantId: string; href: string; initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/core/notifications/unread?tenant=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!cancelled && data && typeof data === "object" && "unread" in data && typeof data.unread === "number") {
          setUnread(data.unread);
        }
      } catch {
        // Netzwerkfehler: alter Wert bleibt stehen
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tenantId, pathname]);

  const label = unread === 0 ? "Benachrichtigungen" : `Benachrichtigungen, ${unread} ungelesen`;
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={pathname === href ? "page" : undefined}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        pathname === href && "bg-sidebar-accent text-foreground",
      )}
    >
      <Bell className="size-4" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
