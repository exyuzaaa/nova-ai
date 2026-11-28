import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { addDays } from "@/modules/calendar/domain/calendar";
import { ABSENCE_STATUS_LABELS, formatDays, fullName } from "@/modules/hr/domain/hr";
import { getAbsenceOverview, getMyEmployeeId, getVacationBalance, listAbsences, listAbsenceTypes, listEmployees } from "@/modules/hr/server/hr";
import { AbsenceButtons, AbsenceRequestForm } from "@/modules/hr/ui/hr-forms";

export const metadata: Metadata = { title: "Abwesenheiten" };

const fmt = (iso: string) => iso.split("-").reverse().join(".");
const range = (start: string, end: string) => (start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`);

async function Absences({ params }: Pick<PageProps<"/app/[tenant]/personal/abwesenheiten">, "params">) {
  const { tenant: slug } = await params;
  const { tenant, permissions } = await requireTenantContext(decodeURIComponent(slug), "hr.view");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: tenant.timezone }).format(new Date());
  const year = Number(today.slice(0, 4));
  const canManage = permissions.has("hr.manage");
  const myEmployeeId = await getMyEmployeeId(tenant.id);
  const [employees, types, requested, mine, overview, balance] = await Promise.all([
    listEmployees(tenant.id),
    listAbsenceTypes(tenant.id),
    listAbsences(tenant.id, { status: "requested" }),
    myEmployeeId ? listAbsences(tenant.id, { employeeId: myEmployeeId, from: addDays(today, -60) }) : Promise.resolve([]),
    getAbsenceOverview(tenant.id, today, addDays(today, 56)),
    myEmployeeId ? getVacationBalance(myEmployeeId, year) : Promise.resolve(null),
  ]);
  const names = new Map(employees.map((employee) => [employee.id, fullName(employee)]));
  const typeById = new Map(types.map((type) => [type.id, type]));
  const reportIds = new Set(employees.filter((employee) => myEmployeeId && employee.managerEmployeeId === myEmployeeId).map((employee) => employee.id));
  const approvals = requested.filter((absence) => absence.employeeId !== myEmployeeId && (canManage || reportIds.has(absence.employeeId)));
  const canRequest = Boolean(myEmployeeId && permissions.has("hr.absences.request")) || canManage;
  const requestFor = canManage ? employees : employees.filter((employee) => employee.id === myEmployeeId);
  const base = `${tenantBasePath(tenant.slug)}/personal`;

  return (
    <>
      <PageHeader title="Abwesenheiten" description="Urlaub beantragen, Anträge entscheiden und sehen, wer in den nächsten Wochen fehlt." />
      {!myEmployeeId && !canManage && (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">
          Dein NOVA-Zugang ist noch keinem Mitarbeiterprofil zugeordnet. Bitte die Personalverwaltung, dich zu verknüpfen.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          {balance && (
            <Section title={`Mein Urlaub ${year}`}>
              <p className="text-2xl font-semibold tabular-nums">{formatDays(balance.remaining)}</p>
              <p className="text-sm text-muted-foreground">
                übrig von {formatDays(balance.entitlement + balance.adjustments)} · {formatDays(balance.taken)} genehmigt · {formatDays(balance.planned)} beantragt
              </p>
            </Section>
          )}
          {canRequest && requestFor.length > 0 && types.length > 0 && (
            <Section title="Neuer Antrag" description="Krankmeldungen gelten sofort; Urlaub entscheidet deine Führungskraft.">
              <AbsenceRequestForm
                tenantId={tenant.id}
                employees={requestFor.map((employee) => ({ id: employee.id, label: fullName(employee) }))}
                types={types.map((type) => ({ id: type.id, label: type.name }))}
                defaultEmployeeId={myEmployeeId ?? requestFor[0].id}
              />
            </Section>
          )}
          {mine.length > 0 && (
            <Section title="Meine Anträge">
              <ul className="flex flex-col divide-y text-sm">
                {mine.map((absence) => (
                  <li key={absence.id} className="flex flex-col gap-1 py-2" aria-label={`${typeById.get(absence.typeId)?.name ?? "Abwesenheit"} ${range(absence.startDate, absence.endDate)}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{typeById.get(absence.typeId)?.name ?? "Abwesenheit"}</span>
                      <span>{range(absence.startDate, absence.endDate)}</span>
                      <span className="text-muted-foreground">({formatDays(absence.days)})</span>
                      <Badge variant={absence.status === "approved" ? "default" : "outline"} className="h-5 text-[11px]">
                        {ABSENCE_STATUS_LABELS[absence.status]}
                      </Badge>
                    </span>
                    {absence.decisionNote && <span className="text-xs text-muted-foreground">Hinweis: {absence.decisionNote}</span>}
                    {(absence.status === "requested" || (absence.status === "approved" && absence.startDate > today)) && (
                      <AbsenceButtons tenantId={tenant.id} absenceId={absence.id} canDecide={false} canCancel />
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {approvals.length > 0 && (
            <Section title={`Zu entscheiden (${approvals.length})`}>
              <ul className="flex flex-col divide-y text-sm">
                {approvals.map((absence) => (
                  <li key={absence.id} className="flex flex-col gap-1 py-2" aria-label={`Antrag von ${names.get(absence.employeeId)}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`${base}/mitarbeiter/${absence.employeeId}`} className="font-medium hover:underline">
                        {names.get(absence.employeeId)}
                      </Link>
                      <span>{typeById.get(absence.typeId)?.name}</span>
                      <span>{range(absence.startDate, absence.endDate)}</span>
                      <span className="text-muted-foreground">({formatDays(absence.days)})</span>
                    </span>
                    {absence.note && <span className="text-xs text-muted-foreground">„{absence.note}“</span>}
                    <AbsenceButtons tenantId={tenant.id} absenceId={absence.id} canDecide canCancel={false} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Wer fehlt in den nächsten 8 Wochen?" description="Gründe sehen nur die Person selbst, ihre Führungskraft und die Personalverwaltung.">
            {overview.length === 0 ? (
              <EmptyState title="Niemand abwesend" />
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {overview.map((entry) => (
                  <li key={entry.absenceId} className="flex flex-wrap items-center gap-2 py-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
                    <span className="min-w-32 font-medium">{entry.employeeName}</span>
                    <span>{range(entry.startDate, entry.endDate)}</span>
                    <span className="text-muted-foreground">{entry.label}</span>
                    {entry.status === "requested" && (
                      <Badge variant="outline" className="h-5 text-[11px]">
                        beantragt
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

export default function AbsencesPage({ params }: PageProps<"/app/[tenant]/personal/abwesenheiten">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Abwesenheiten werden geladen" />}>
      <Absences params={params} />
    </Suspense>
  );
}
