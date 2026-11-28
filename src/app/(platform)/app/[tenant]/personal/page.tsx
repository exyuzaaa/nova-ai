import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/app/page-section";
import { NativeSelect } from "@/components/app/native-select";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { EMPLOYMENT_LABELS, fullName } from "@/modules/hr/domain/hr";
import { listDepartments, listEmployees } from "@/modules/hr/server/hr";

export const metadata: Metadata = { title: "Mitarbeiter" };

async function Directory({ params, searchParams }: Pick<PageProps<"/app/[tenant]/personal">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "hr.view");
  const q = typeof query.q === "string" ? query.q.slice(0, 100) : "";
  const departmentId = typeof query.abteilung === "string" && uuidSchema.safeParse(query.abteilung).success ? query.abteilung : undefined;
  const former = query.ehemalige === "1";
  const [employees, departments, all] = await Promise.all([
    listEmployees(tenant.id, { q, departmentId, former }),
    listDepartments(tenant.id),
    listEmployees(tenant.id, { former: false }),
  ]);
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const names = new Map(all.map((employee) => [employee.id, fullName(employee)]));
  const base = `${tenantBasePath(tenant.slug)}/personal`;

  return (
    <>
      <PageHeader
        title={former ? "Ehemalige Mitarbeiter" : "Mitarbeiter"}
        description={`${employees.length} ${employees.length === 1 ? "Person" : "Personen"}`}
        actions={
          permissions.has("hr.manage") && (
            <Button asChild size="sm">
              <Link href={`${base}/neu`}>
                <Plus className="size-4" aria-hidden />
                Neuer Mitarbeiter
              </Link>
            </Button>
          )
        }
      />
      <form className="flex flex-wrap items-end gap-2" role="search" aria-label="Mitarbeiter filtern">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor="hr-search" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="hr-search"
            name="q"
            defaultValue={q}
            placeholder="Name, Position oder Personalnummer"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        {departments.length > 0 && (
          <NativeSelect label="Abteilung" name="abteilung" defaultValue={departmentId ?? ""}>
            <option value="">Alle</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {former && <input type="hidden" name="ehemalige" value="1" />}
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>
      {employees.length === 0 ? (
        <EmptyState title={q || departmentId ? "Niemand gefunden" : "Noch keine Mitarbeiter"}>
          {permissions.has("hr.manage") && !former && !q && "Lege Mitarbeiter an, um Urlaub, Abwesenheiten und Onboarding zu verwalten."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <li key={employee.id}>
              <Link href={`${base}/mitarbeiter/${employee.id}`} className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 hover:bg-muted/40">
                <span className="font-medium">{fullName(employee)}</span>
                <span className="text-sm text-muted-foreground">{[employee.position, employee.departmentId && departmentNames.get(employee.departmentId)].filter(Boolean).join(" · ") || "–"}</span>
                <span className="mt-auto text-xs text-muted-foreground">
                  {employee.personnelNumber} · {EMPLOYMENT_LABELS[employee.employmentType]}
                  {employee.managerEmployeeId && names.get(employee.managerEmployeeId) && ` · berichtet an ${names.get(employee.managerEmployeeId)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        <Link href={former ? base : `${base}?ehemalige=1`} className="hover:underline">
          {former ? "Zu den aktuellen Mitarbeitern" : "Ehemalige anzeigen"}
        </Link>
      </p>
    </>
  );
}

export default function HrPage({ params, searchParams }: PageProps<"/app/[tenant]/personal">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Mitarbeiter werden geladen" />}>
      <Directory params={params} searchParams={searchParams} />
    </Suspense>
  );
}
