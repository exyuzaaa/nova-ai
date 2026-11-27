import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/modules/auth/server/session";
import { hasRole } from "@/modules/core/domain/roles";
import { listMyTenants } from "@/modules/core/server/tenants";
import { getSite, listSites, type Site } from "../../server/sites";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { SiteSwitcher, type SiteOption } from "./site-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const toOption = ({ id, name, domain, isDemo, organizationName }: Site): SiteOption => ({
  id,
  name,
  domain,
  isDemo,
  organizationName,
});

/** Lädt Nutzer, aktuelle Website, alle Websites und ob Websites angelegt werden dürfen. */
const loadShell = async (siteId: string) => {
  const user = await requireUser(`/analytics/${siteId}`);
  const [site, sites, tenants] = await Promise.all([getSite(siteId), listSites(), listMyTenants()]);
  if (!site) notFound();
  const canAddWebsite = tenants.some((tenant) => hasRole(tenant.role, "admin"));
  return { user, site, sites: sites.map(toOption), canAddWebsite };
};

async function SidebarContent({ siteId }: { siteId: string }) {
  const { user, site, sites, canAddWebsite } = await loadShell(siteId);
  return (
    <>
      <SiteSwitcher sites={sites} currentId={site.id} canAddWebsite={canAddWebsite} />
      <div className="mt-5 flex-1 overflow-y-auto">
        <SidebarNav siteId={site.id} isDemo={site.isDemo} />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <ThemeToggle />
        <UserMenu email={user.email} />
      </div>
    </>
  );
}

async function MobileBar({ siteId }: { siteId: string }) {
  const { user, site, sites, canAddWebsite } = await loadShell(siteId);
  return (
    <>
      <MobileNav
        siteId={site.id}
        isDemo={site.isDemo}
        sites={sites}
        canAddWebsite={canAddWebsite}
        userMenu={<UserMenu email={user.email} />}
      />
      <span className="truncate text-sm font-medium">{site.name}</span>
    </>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mt-4 h-4 w-20" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function AppShell({ siteId, children }: { siteId: Promise<string>; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <Suspense fallback={<SidebarSkeleton />}>{siteId.then((id) => <SidebarContent siteId={id} />)}</Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur lg:hidden">
          <Suspense fallback={<Skeleton className="h-6 w-32" />}>
            {siteId.then((id) => <MobileBar siteId={id} />)}
          </Suspense>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
