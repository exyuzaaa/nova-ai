import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listAbsenceTypes, listHolidays } from "@/modules/hr/server/hr";
import { AbsenceTypeForm, ArchiveTypeButton, DeleteHolidayButton, HolidayForm } from "@/modules/hr/ui/hr-forms";

export const metadata: Metadata = { title: "Einstellungen" };

async function Settings({ params }: Pick<PageProps<"/app/[tenant]/personal/einstellungen">, "params">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "hr.manage");
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric" }).format(new Date()));
  const [types, holidays, nextHolidays] = await Promise.all([listAbsenceTypes(tenant.id, true), listHolidays(tenant.id, year), listHolidays(tenant.id, year + 1)]);
  return (
    <>
      <PageHeader title="Personal-Einstellungen" />
      <Section title="Abwesenheitsarten" description="„Zählt als Urlaub“ verringert den Resturlaub. Ohne Genehmigung gilt ein Eintrag sofort (z. B. Krankheit).">
        <ul className="flex flex-col divide-y">
          {types.map((type) => (
            <li key={type.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <AbsenceTypeForm tenantId={tenant.id} values={type} />
              </div>
              <ArchiveTypeButton tenantId={tenant.id} typeId={type.id} archived={type.archived} />
            </li>
          ))}
        </ul>
        <AbsenceTypeForm tenantId={tenant.id} />
      </Section>
      <Section title="Feiertage" description="Feiertage zählen nicht als Urlaubstage. Trage die Feiertage deines Bundeslandes ein.">
        <ul className="flex flex-col gap-1 text-sm">
          {[...holidays, ...nextHolidays].map((holiday) => (
            <li key={holiday.date} className="flex items-center gap-2">
              <span className="w-24 tabular-nums">{holiday.date.split("-").reverse().join(".")}</span>
              <span className="flex-1">{holiday.name}</span>
              <DeleteHolidayButton tenantId={tenant.id} date={holiday.date} name={holiday.name} />
            </li>
          ))}
        </ul>
        <HolidayForm tenantId={tenant.id} />
      </Section>
    </>
  );
}

export default function HrSettingsPage({ params }: PageProps<"/app/[tenant]/personal/einstellungen">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Einstellungen werden geladen" />}>
      <Settings params={params} />
    </Suspense>
  );
}
