import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { fullName } from "@/modules/hr/domain/hr";
import { listDepartments, listEmployees } from "@/modules/hr/server/hr";
import { EmployeeForm } from "@/modules/hr/ui/hr-forms";

export const metadata: Metadata = { title: "Neuer Mitarbeiter" };

async function NewEmployee({ params }: Pick<PageProps<"/app/[tenant]/personal/neu">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "hr.manage");
  const [departments, employees, members] = await Promise.all([listDepartments(tenant.id), listEmployees(tenant.id), listMembers(tenant.id)]);
  const linked = new Set(employees.map((employee) => employee.memberId).filter(Boolean));
  return (
    <>
      <PageHeader title="Neuer Mitarbeiter" description="Vertrauliche Daten wie Bankverbindung und Gehalt trägst du danach im Profil ein." />
      <Section title="Stammdaten">
        <EmployeeForm
          tenantId={tenant.id}
          departments={departments.map((department) => ({ id: department.id, label: department.name }))}
          managers={employees.map((employee) => ({ id: employee.id, label: fullName(employee) }))}
          members={members.filter((member) => !linked.has(member.memberId)).map((member) => ({ id: member.memberId, label: member.email }))}
          values={{
            firstName: "",
            lastName: "",
            workEmail: null,
            workPhone: null,
            position: null,
            departmentId: null,
            managerEmployeeId: null,
            memberId: null,
            employmentType: "full_time",
            entryDate: null,
            exitDate: null,
            weeklyHours: 40,
            workDays: [1, 2, 3, 4, 5],
            vacationDays: 30,
          }}
        />
      </Section>
    </>
  );
}

export default function NewEmployeePage({ params }: PageProps<"/app/[tenant]/personal/neu">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
      <NewEmployee params={params} />
    </Suspense>
  );
}
