import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section } from "@/components/app/page-section";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { isIsoDate } from "@/modules/calendar/domain/calendar";
import { listCalendars } from "@/modules/calendar/server/calendar";
import { EventForm } from "@/modules/calendar/ui/event-forms";

export const metadata: Metadata = { title: "Neuer Termin" };

async function NewEvent({ params, searchParams }: Pick<PageProps<"/app/[tenant]/kalender/neu">, "params" | "searchParams">) {
  const [{ tenant: slug }, query] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "calendar.edit");
  const [calendars, members] = await Promise.all([listCalendars(tenant.id), listMembers(tenant.id)]);
  const editable = calendars.filter((calendar) => calendar.canEdit);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: tenant.timezone }).format(new Date());
  const date = typeof query.datum === "string" && isIsoDate(query.datum) ? query.datum : today;
  const label = (kind: string, name: string) => (kind === "personal" ? "Mein Kalender" : kind === "company" ? `Unternehmen (${name})` : `Team: ${name}`);

  return (
    <>
      <PageHeader title="Neuer Termin" />
      {editable.length === 0 ? (
        <EmptyState title="Kein Kalender verfügbar">Dir fehlt das Recht, Termine einzutragen.</EmptyState>
      ) : (
        <Section title="Termin">
          <EventForm
            tenantId={tenant.id}
            calendars={editable.map((calendar) => ({ id: calendar.id, label: label(calendar.kind, calendar.name) }))}
            members={members.filter((member) => !member.isSelf).map((member) => ({ id: member.memberId, label: member.email }))}
            values={{
              calendarId: editable[0].id,
              title: "",
              description: null,
              location: null,
              allDay: false,
              startDate: date,
              startTime: "09:00",
              endDate: date,
              endTime: "10:00",
              repeatFreq: null,
              repeatInterval: 1,
              repeatWeekdays: [],
              repeatUntil: null,
              repeatCount: null,
              reminderMinutes: 15,
              attendees: [],
            }}
          />
        </Section>
      )}
    </>
  );
}

export default function NewEventPage({ params, searchParams }: PageProps<"/app/[tenant]/kalender/neu">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Formular wird geladen" />}>
      <NewEvent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
