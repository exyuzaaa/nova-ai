import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { buildPlatformNavigation, tenantBasePath } from "../../config/navigation";
import { ROLE_LABELS } from "../../domain/roles";
import { countUnreadNotifications } from "../../server/notifications";
import { loadTenantContext } from "../../server/tenant-context";
import { PlatformMobileNav } from "./platform-mobile-nav";
import { NotificationBell } from "./notification-bell";
import { PlatformNav } from "./platform-nav";
import { SearchBox } from "./search-box";
import { TenantSwitcher } from "./tenant-switcher";

const loadShell = async (slug: string) => {
  const context = await loadTenantContext(slug);
  const unread = await countUnreadNotifications(context.tenant.id);
  const enabled = new Set(context.modules.filter((module) => module.enabled).map((module) => module.key));
  const base = tenantBasePath(context.tenant.slug);
  return {
    context,
    unread,
    searchAction: `${base}/suche`,
    notificationsHref: `${base}/benachrichtigungen`,
    groups: buildPlatformNavigation(context.tenant.slug, context.permissions, enabled),
    tenants: context.tenants.map((tenant) => ({
      slug: tenant.slug,
      name: tenant.name,
      roleLabel: ROLE_LABELS[tenant.role],
      suspended: tenant.suspended,
    })),
  };
};

async function Sidebar({ slug }: { slug: string }) {
  const { context, groups, tenants, unread, searchAction, notificationsHref } = await loadShell(slug);
  return (
    <>
      <TenantSwitcher tenants={tenants} currentSlug={context.tenant.slug} />
      <div className="mt-3 flex items-center gap-1">
        <SearchBox action={searchAction} />
        <NotificationBell tenantId={context.tenant.id} href={notificationsHref} initialUnread={unread} />
      </div>
      <div className="mt-5 flex-1 overflow-y-auto">
        <PlatformNav groups={groups} />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <ThemeToggle />
        <UserMenu email={context.user.email} />
      </div>
    </>
  );
}

async function MobileBar({ slug }: { slug: string }) {
  const { context, groups, tenants, unread, searchAction, notificationsHref } = await loadShell(slug);
  return (
    <>
      <PlatformMobileNav
        groups={groups}
        tenants={tenants}
        currentSlug={context.tenant.slug}
        search={<SearchBox action={searchAction} />}
        userMenu={<UserMenu email={context.user.email} />}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{context.tenant.name}</span>
      <NotificationBell tenantId={context.tenant.id} href={notificationsHref} initialUnread={unread} />
    </>
  );
}

async function SuspendedNotice({ slug }: { slug: string }) {
  const { tenant } = await loadTenantContext(slug);
  if (!tenant.suspended) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">
      Dieses Unternehmen ist vorübergehend gesperrt. Inhalte und Module sind nicht verfügbar. Bitte wende dich an den
      NOVA-Support.
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mt-4 h-4 w-20" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

/** Rahmen für alle Seiten unter /app/[unternehmen]. */
export function PlatformShell({ slug, children }: { slug: Promise<string>; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <Suspense fallback={<SidebarSkeleton />}>{slug.then((value) => <Sidebar slug={value} />)}</Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur lg:hidden">
          <Suspense fallback={<Skeleton className="h-6 w-32" />}>{slug.then((value) => <MobileBar slug={value} />)}</Suspense>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={null}>{slug.then((value) => <SuspendedNotice slug={value} />)}</Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
