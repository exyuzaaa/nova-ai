import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { cn } from "@/lib/utils";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import {
  parseProjectListQuery,
  progress,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  todayIn,
  type ProjectListQuery,
} from "@/modules/projects/domain/projects";
import { getMyMemberId, listProjects } from "@/modules/projects/server/projects";

export const metadata: Metadata = { title: "Projekte" };

const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });
const formatDate = (value: string) => date.format(new Date(`${value}T00:00:00Z`));

const queryString = (query: ProjectListQuery, overrides: Partial<ProjectListQuery>) => {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status !== "open") params.set("status", merged.status);
  if (merged.mine) params.set("meine", "1");
  if (merged.archived) params.set("archiv", "1");
  const value = params.toString();
  return value ? `?${value}` : "";
};

async function ProjectList({ params, searchParams }: Pick<PageProps<"/app/[tenant]/projekte">, "params" | "searchParams">) {
  const [{ tenant: slug }, rawQuery] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "projects.view");
  const query = parseProjectListQuery(rawQuery);
  const myMemberId = await getMyMemberId(tenant.id);
  const [projects, members] = await Promise.all([listProjects(tenant.id, query, myMemberId), listMembers(tenant.id)]);
  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  const base = `${tenantBasePath(tenant.slug)}/projekte`;
  const today = todayIn(tenant.timezone);

  return (
    <>
      <PageHeader
        title={query.archived ? "Archivierte Projekte" : "Projekte"}
        description={`${projects.length} ${projects.length === 1 ? "Projekt" : "Projekte"}`}
        actions={
          <>
            {permissions.has("projects.time") && (
              <Button asChild size="sm" variant="outline">
                <Link href={`${base}/zeiten`}>
                  <Clock className="size-4" aria-hidden />
                  Meine Zeiten
                </Link>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/vorlagen`}>Vorlagen</Link>
            </Button>
            {permissions.has("projects.edit") && (
              <Button asChild size="sm">
                <Link href={`${base}/neu`}>
                  <Plus className="size-4" aria-hidden />
                  Neues Projekt
                </Link>
              </Button>
            )}
          </>
        }
      />

      <form className="flex flex-wrap items-end gap-2" role="search" aria-label="Projekte filtern">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="project-search" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="project-search"
            name="q"
            defaultValue={query.q}
            placeholder="Name oder Nummer"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <NativeSelect label="Status" name="status" defaultValue={query.status}>
          <option value="open">Laufend</option>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABELS[status]}
            </option>
          ))}
          <option value="all">Alle</option>
        </NativeSelect>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="meine" value="1" defaultChecked={query.mine} />
          Nur meine
        </label>
        {query.archived && <input type="hidden" name="archiv" value="1" />}
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>

      {projects.length === 0 ? (
        <EmptyState title={query.q || query.mine || query.status !== "open" ? "Keine passenden Projekte" : "Noch keine Projekte"}>
          {permissions.has("projects.edit") && !query.archived && "Lege dein erstes Projekt an und plane Aufgaben, Meilensteine und Zeiten."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const percent = progress(project.progress.done, project.progress.total);
            const overdueProject = project.dueDate && project.dueDate < today && !["completed", "cancelled"].includes(project.status);
            return (
              <li key={project.id}>
                <Link
                  href={`${base}/${project.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
                  aria-label={`${project.name} (${project.number})`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
                      <span className="truncate font-medium">{project.name}</span>
                    </span>
                    {project.visibility === "members" && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Nur für Projektmitglieder" />}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{project.number}</span>
                    <Badge variant={project.status === "active" ? "default" : "outline"} className="h-5 text-[11px]">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                    {project.leadMemberId && <span className="truncate">{memberNames.get(project.leadMemberId)}</span>}
                  </span>
                  <span className="mt-auto flex flex-col gap-1">
                    <span className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {project.progress.done} von {project.progress.total} Aufgaben
                        {project.progress.overdue > 0 && <span className="text-negative"> · {project.progress.overdue} überfällig</span>}
                      </span>
                      <span className="tabular-nums">{percent} %</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Fortschritt ${project.name}`}>
                      <span className="block h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: project.color }} />
                    </span>
                    {project.dueDate && (
                      <span className={cn("text-xs", overdueProject ? "text-negative" : "text-muted-foreground")}>Ende {formatDate(project.dueDate)}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        <Link href={`${base}${queryString(query, { archived: !query.archived })}`} className="hover:underline">
          {query.archived ? "Zu den laufenden Projekten" : "Archivierte Projekte anzeigen"}
        </Link>
      </p>
    </>
  );
}

export default function ProjectsPage({ params, searchParams }: PageProps<"/app/[tenant]/projekte">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Projekte werden geladen" />}>
      <ProjectList params={params} searchParams={searchParams} />
    </Suspense>
  );
}
