import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { getCrmOverview } from "@/modules/crm/server/overview";

export const metadata: Metadata = { title: "Übersicht" };

function Stat({ label, value, href, alert }: { label: string; value: number; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40 sm:p-4">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xl font-semibold tabular-nums sm:text-2xl", alert && value > 0 && "text-negative")}>{value}</span>
    </Link>
  );
}

async function Overview({ params }: Pick<PageProps<"/app/[tenant]/crm">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "crm.view");
  const overview = await getCrmOverview(tenant.id);
  const base = `${tenantBasePath(tenant.slug)}/crm`;
  const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: tenant.timezone });
  const taskHref = (task: (typeof overview.upcomingTasks)[number]) =>
    task.customerId ? `${base}/kunden/${task.customerId}` : base;

  return (
    <>
      <PageHeader
        title="CRM"
        description="Kunden, Ansprechpartner und Aufgaben"
        actions={
          permissions.has("crm.edit") && (
            <Button asChild size="sm">
              <Link href={`${base}/kunden/neu`}>
                <Plus className="size-4" aria-hidden />
                Neuer Kunde
              </Link>
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Stat label="Kunden" value={overview.customers} href={`${base}/kunden`} />
        <Stat label="Interessenten" value={overview.prospects} href={`${base}/kunden?status=prospect`} />
        <Stat label="Offene Aufgaben" value={overview.openTasks} href={`${base}/kunden`} />
        <Stat label="Überfällig" value={overview.overdueTasks} href={`${base}/kunden`} alert />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Nächste Aufgaben">
          {overview.upcomingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine offenen Aufgaben.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {overview.upcomingTasks.map((task) => {
                const overdue = task.overdue;
                return (
                  <li key={task.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
                    <Link href={taskHref(task)} className="font-medium hover:underline">
                      {task.subject}
                    </Link>
                    <span className={cn("text-xs", overdue ? "font-medium text-negative" : "text-muted-foreground")}>
                      {overdue ? "überfällig seit " : "fällig "}
                      {dateTime.format(new Date(task.dueAt))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section title="Neueste Kunden">
          {overview.recentCustomers.length === 0 ? (
            <EmptyState title="Noch keine Kunden">
              {permissions.has("crm.edit") ? "Lege deinen ersten Kunden an." : "Hier erscheinen die Kunden deines Unternehmens."}
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y">
              {overview.recentCustomers.map((customer) => (
                <li key={customer.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <Link href={`${base}/kunden/${customer.id}`} className="min-w-0 truncate font-medium hover:underline">
                    {customer.name}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{customer.number}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

export default function CrmPage({ params }: PageProps<"/app/[tenant]/crm">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="CRM wird geladen" />}>
      <Overview params={params} />
    </Suspense>
  );
}
