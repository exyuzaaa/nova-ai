import { Suspense } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { PROJECT_STATUS_LABELS } from "@/modules/projects/domain/projects";
import { getCustomerName } from "@/modules/projects/server/projects";
import { loadProjectContext } from "@/modules/projects/server/context";
import { ProjectTabs } from "@/modules/projects/ui/project-tabs";

const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00Z`));

async function ProjectHeader({ slug, projectId }: { slug: string; projectId: string }) {
  const { tenant, project, memberNames, permissions } = await loadProjectContext(slug, projectId);
  const base = `${tenantBasePath(tenant.slug)}/projekte/${project.id}`;
  const customer = project.customerId && permissions.has("crm.view") ? await getCustomerName(tenant.id, project.customerId) : null;
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href={`${tenantBasePath(tenant.slug)}/projekte`} className="hover:underline">
            Projekte
          </Link>
          <span aria-hidden>/</span>
          <span className="font-mono">{project.number}</span>
        </p>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
          <span className="min-w-0 break-words">{project.name}</span>
          {project.visibility === "members" && <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Nur für Projektmitglieder" />}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={project.status === "active" ? "default" : "outline"} className="h-5 text-[11px]">
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
          {project.archivedAt && (
            <Badge variant="outline" className="h-5 text-[11px]">
              Archiviert – schreibgeschützt
            </Badge>
          )}
          {project.leadMemberId && <span>Leitung: {memberNames.get(project.leadMemberId) ?? "–"}</span>}
          {(project.startDate || project.dueDate) && (
            <span>
              {project.startDate ? formatDate(project.startDate) : "…"} – {project.dueDate ? formatDate(project.dueDate) : "…"}
            </span>
          )}
          {customer && project.customerId && (
            <Link href={`${tenantBasePath(tenant.slug)}/crm/kunden/${project.customerId}`} className="font-medium text-brand hover:underline">
              {customer}
            </Link>
          )}
        </p>
      </header>
      <ProjectTabs
        base={base}
        tabs={[
          { href: "", label: "Aufgaben", exact: true },
          { href: "/board", label: "Board" },
          { href: "/meilensteine", label: "Meilensteine" },
          { href: "/einstellungen", label: project.canManage ? "Einstellungen" : "Team und Details" },
        ]}
      />
    </>
  );
}

export default function ProjectLayout({ children, params }: LayoutProps<"/app/[tenant]/projekte/[projectId]">) {
  return (
    <>
      <Suspense fallback={<div className="h-24 border-b" />}>
        {params.then(({ tenant, projectId }) => (
          <ProjectHeader slug={decodeURIComponent(tenant)} projectId={projectId} />
        ))}
      </Suspense>
      {children}
    </>
  );
}
