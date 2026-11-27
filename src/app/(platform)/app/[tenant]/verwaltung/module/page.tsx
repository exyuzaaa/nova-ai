import { Suspense } from "react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { ModuleToggle } from "@/modules/core/ui/admin/module-toggle";

export const metadata: Metadata = { title: "Module" };

const STATUS_LABEL = { available: "Verfügbar", beta: "Beta", planned: "In Entwicklung", retired: "Eingestellt" } as const;

async function Modules({ params }: Pick<PageProps<"/app/[tenant]/verwaltung/module">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions, modules } = await requireTenantContext(decodeURIComponent(slug), "core.members.read");
  const canManage = permissions.has("core.modules.manage");
  const usable = modules.filter((module) => !module.isCore && (module.status === "available" || module.status === "beta"));
  const upcoming = modules.filter((module) => module.status === "planned");

  return (
    <>
      <Section
        title="Verfügbare Module"
        description={canManage ? "Ausgeschaltete Module sind für alle Mitglieder gesperrt; ihre Daten bleiben erhalten." : "Nur Administratoren können Module schalten."}
      >
        <ul className="flex flex-col divide-y rounded-lg border">
          {usable.map((module) => (
            <li key={module.key} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {module.name}
                  <Badge variant={module.enabled ? "default" : "outline"} className="h-5 text-[11px]">
                    {module.enabled ? "Eingeschaltet" : "Ausgeschaltet"}
                  </Badge>
                  {module.status === "beta" && (
                    <Badge variant="outline" className="h-5 text-[11px]">
                      Beta
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
              {canManage && <ModuleToggle tenantId={tenant.id} moduleKey={module.key} moduleName={module.name} enabled={module.enabled} />}
            </li>
          ))}
        </ul>
      </Section>

      {upcoming.length > 0 && (
        <Section title="In Entwicklung" description="Diese Module werden gerade gebaut und können noch nicht eingeschaltet werden.">
          <ul className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((module) => (
              <li key={module.key} className="rounded-lg border p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {module.name}
                  <Badge variant="outline" className="h-5 text-[11px]">
                    {STATUS_LABEL[module.status]}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

export default function ModulesPage({ params }: PageProps<"/app/[tenant]/verwaltung/module">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Module" description="Welche Bereiche von NOVA dein Unternehmen nutzt" />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Module werden geladen" />}>
        <Modules params={params} />
      </Suspense>
    </div>
  );
}
