import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { WEEKDAYS } from "@/modules/calendar/domain/calendar";
import { ABSENCE_STATUS_LABELS, EMPLOYMENT_LABELS, formatDays, fullName } from "@/modules/hr/domain/hr";
import {
  getEmployee,
  getMyEmployeeId,
  getPrivateData,
  getVacationBalance,
  listAbsences,
  listAbsenceTypes,
  listAdjustments,
  listDepartments,
  listEmployees,
  listOnboarding,
} from "@/modules/hr/server/hr";
import { AbsenceButtons, AdjustmentForm, DeleteAdjustmentButton, DeleteEmployeeButton, EmployeeForm, OnboardingList, PrivateForm } from "@/modules/hr/ui/hr-forms";

export const metadata: Metadata = { title: "Mitarbeiter" };

const fmt = (iso: string) => iso.split("-").reverse().join(".");

async function Profile({ params }: Pick<PageProps<"/app/[tenant]/personal/mitarbeiter/[employeeId]">, "params">) {
  const { tenant: slug, employeeId } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "hr.view");
  if (!uuidSchema.safeParse(employeeId).success) notFound();
  const employee = await getEmployee(tenant.id, employeeId);
  if (!employee) notFound();
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric" }).format(new Date()));
  const canManage = permissions.has("hr.manage");
  const canSensitive = permissions.has("hr.sensitive");
  const [all, departments, members, myEmployeeId, balance, absences, types, adjustments, onboarding, privateData] = await Promise.all([
    listEmployees(tenant.id),
    listDepartments(tenant.id),
    listMembers(tenant.id),
    getMyEmployeeId(tenant.id),
    getVacationBalance(employee.id, year),
    listAbsences(tenant.id, { employeeId: employee.id }),
    listAbsenceTypes(tenant.id, true),
    canManage ? listAdjustments(tenant.id, employee.id, year) : Promise.resolve([]),
    listOnboarding(tenant.id, employee.id),
    canSensitive ? getPrivateData(tenant.id, employee.id) : Promise.resolve(null),
  ]);
  const names = new Map(all.map((entry) => [entry.id, fullName(entry)]));
  const department = departments.find((entry) => entry.id === employee.departmentId);
  const reports = all.filter((entry) => entry.managerEmployeeId === employee.id);
  const typeNames = new Map(types.map((type) => [type.id, type]));
  const memberNames = Object.fromEntries(members.map((member) => [member.memberId, member.email]));
  const isManager = employee.managerEmployeeId !== null && employee.managerEmployeeId === myEmployeeId;
  const base = `${tenantBasePath(tenant.slug)}/personal`;
  const linked = new Set(all.map((entry) => entry.memberId).filter((id) => id && id !== employee.memberId));

  return (
    <>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{employee.personnelNumber}</p>
          <h1 className="text-xl font-semibold tracking-tight">{fullName(employee)}</h1>
          <p className="text-sm text-muted-foreground">
            {[employee.position, department?.name, EMPLOYMENT_LABELS[employee.employmentType]].filter(Boolean).join(" · ")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {employee.workEmail && (
              <li className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                <a href={`mailto:${employee.workEmail}`} className="hover:underline">
                  {employee.workEmail}
                </a>
              </li>
            )}
            {employee.workPhone && (
              <li className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                {employee.workPhone}
              </li>
            )}
            {employee.managerEmployeeId && (
              <li>
                Berichtet an{" "}
                <Link href={`${base}/mitarbeiter/${employee.managerEmployeeId}`} className="font-medium text-brand hover:underline">
                  {names.get(employee.managerEmployeeId) ?? "–"}
                </Link>
              </li>
            )}
          </ul>
          {employee.exitDate && (
            <Badge variant="outline" className="mt-2 h-5 text-[11px]">
              Austritt {fmt(employee.exitDate)}
            </Badge>
          )}
        </div>
        {canManage && <DeleteEmployeeButton tenantId={tenant.id} employeeId={employee.id} name={fullName(employee)} />}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          {balance && (
            <Section title={`Urlaub ${year}`}>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted-foreground">Anspruch</dt>
                <dd className="text-right tabular-nums">{formatDays(balance.entitlement)}</dd>
                {balance.adjustments !== 0 && (
                  <>
                    <dt className="text-muted-foreground">Korrekturen</dt>
                    <dd className="text-right tabular-nums">{formatDays(balance.adjustments)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Genommen/genehmigt</dt>
                <dd className="text-right tabular-nums">{formatDays(balance.taken)}</dd>
                <dt className="text-muted-foreground">Beantragt</dt>
                <dd className="text-right tabular-nums">{formatDays(balance.planned)}</dd>
                <dt className="font-medium">Resturlaub</dt>
                <dd className="text-right font-semibold tabular-nums">{formatDays(balance.remaining)}</dd>
              </dl>
              {canManage && (
                <>
                  {adjustments.length > 0 && (
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {adjustments.map((adjustment) => (
                        <li key={adjustment.id} className="flex items-center gap-2">
                          <span className="flex-1">
                            {formatDays(adjustment.days)} – {adjustment.reason}
                          </span>
                          <DeleteAdjustmentButton tenantId={tenant.id} employeeId={employee.id} adjustmentId={adjustment.id} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <AdjustmentForm tenantId={tenant.id} employeeId={employee.id} year={year} />
                </>
              )}
            </Section>
          )}
          {(balance || absences.length > 0) && (
            <Section title="Abwesenheiten">
              {absences.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Abwesenheiten.</p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {absences.map((absence) => {
                    const type = typeNames.get(absence.typeId);
                    const active = absence.status === "requested" || absence.status === "approved";
                    return (
                      <li key={absence.id} className="flex flex-col gap-1 py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="size-2 rounded-full" style={{ backgroundColor: type?.color }} aria-hidden />
                          <span className="font-medium">{type?.name}</span>
                          <span>
                            {fmt(absence.startDate)}
                            {absence.endDate !== absence.startDate && ` – ${fmt(absence.endDate)}`}
                          </span>
                          <span className="text-muted-foreground">({formatDays(absence.days)})</span>
                          <Badge variant={absence.status === "approved" ? "default" : "outline"} className="h-5 text-[11px]">
                            {ABSENCE_STATUS_LABELS[absence.status]}
                          </Badge>
                        </span>
                        {absence.decisionNote && <span className="text-xs text-muted-foreground">Hinweis: {absence.decisionNote}</span>}
                        {active && (canManage || isManager) && (
                          <AbsenceButtons tenantId={tenant.id} absenceId={absence.id} canDecide={absence.status === "requested"} canCancel />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}
          {reports.length > 0 && (
            <Section title="Direkte Mitarbeitende">
              <ul className="flex flex-col gap-1 text-sm">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Link href={`${base}/mitarbeiter/${report.id}`} className="hover:underline">
                      {fullName(report)}
                    </Link>
                    {report.position && <span className="text-muted-foreground"> · {report.position}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {(canManage || onboarding.length > 0) && (
            <Section title="Onboarding">
              <OnboardingList
                tenantId={tenant.id}
                employeeId={employee.id}
                tasks={onboarding}
                members={members.map((member) => ({ id: member.memberId, label: member.email }))}
                memberNames={memberNames}
                canManage={canManage}
              />
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {canManage ? (
            <Section title="Stammdaten">
              <EmployeeForm
                tenantId={tenant.id}
                departments={departments.map((entry) => ({ id: entry.id, label: entry.name }))}
                managers={all.filter((entry) => entry.id !== employee.id).map((entry) => ({ id: entry.id, label: fullName(entry) }))}
                members={members.filter((member) => !linked.has(member.memberId)).map((member) => ({ id: member.memberId, label: member.email }))}
                values={employee}
              />
            </Section>
          ) : (
            <Section title="Arbeitszeit">
              <p className="text-sm">
                {employee.weeklyHours !== null ? `${String(employee.weeklyHours).replace(".", ",")} Stunden pro Woche · ` : ""}
                {employee.workDays.map((day) => WEEKDAYS[day - 1].short).join(", ")}
                {employee.entryDate && ` · seit ${fmt(employee.entryDate)}`}
              </p>
            </Section>
          )}
          {canSensitive && (
            <Section title="Vertrauliche Daten" description="Nur für Personen mit dem Recht „Vertrauliche Personaldaten“. Änderungen werden ohne Inhalte protokolliert.">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden /> Gesundheitsdaten (Diagnosen) gehören nicht hierher.
              </p>
              <PrivateForm tenantId={tenant.id} employeeId={employee.id} values={privateData} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

export default function EmployeePage({ params }: PageProps<"/app/[tenant]/personal/mitarbeiter/[employeeId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Profil wird geladen" />}>
      <Profile params={params} />
    </Suspense>
  );
}
