import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listTemplates } from "@/modules/projects/server/time";
import { CopyProjectForm } from "@/modules/projects/ui/time-forms";

export const metadata: Metadata = { title: "Vorlagen" };

async function Templates({ params }: Pick<PageProps<"/app/[tenant]/projekte/vorlagen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "projects.view");
  const templates = await listTemplates(tenant.id);
  const base = `${tenantBasePath(tenant.slug)}/projekte`;
  return (
    <>
      <PageHeader title="Projektvorlagen" description="Wiederkehrende Abläufe einmal planen und für neue Projekte übernehmen." />
      {templates.length === 0 ? (
        <EmptyState title="Noch keine Vorlagen">
          {permissions.has("projects.manage")
            ? "Öffne ein Projekt, gehe zu „Einstellungen“ und wähle „Als Vorlage speichern“."
            : "Administratorinnen und Administratoren können Projekte als Vorlage speichern."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <li key={template.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label={`Vorlage ${template.name}`}>
              <div>
                <h2 className="font-medium">
                  <Link href={`${base}/${template.id}`} className="hover:underline">
                    {template.name}
                  </Link>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {template.number} · {template.taskCount} Aufgaben
                </p>
                {template.description && <p className="mt-1 line-clamp-3 text-sm">{template.description}</p>}
              </div>
              {permissions.has("projects.edit") && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Projekt aus dieser Vorlage anlegen</summary>
                  <div className="mt-3">
                    <CopyProjectForm tenantId={tenant.id} sourceId={template.id} asTemplate={false} submitLabel="Projekt anlegen" />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        <Link href={base} className="hover:underline">
          Zu den Projekten
        </Link>
      </p>
    </>
  );
}

export default function TemplatesPage({ params }: PageProps<"/app/[tenant]/projekte/vorlagen">) {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" role="status" aria-label="Vorlagen werden geladen" />}>
      <Templates params={params} />
    </Suspense>
  );
}
