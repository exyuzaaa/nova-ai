import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MapPin, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/app/page-section";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { utcToLocalDateTime } from "@/modules/core/domain/time-zone";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { addDays, describeRepeat, REMINDER_OPTIONS, RESPONSE_LABELS } from "@/modules/calendar/domain/calendar";
import { getBusy, getEvent, getMyMemberId, listCalendars } from "@/modules/calendar/server/calendar";
import { DeleteEventButtons, EventForm, RespondButtons } from "@/modules/calendar/ui/event-forms";

export const metadata: Metadata = { title: "Termin" };

async function EventDetail({ params, searchParams }: Pick<PageProps<"/app/[tenant]/kalender/termine/[eventId]">, "params" | "searchParams">) {
  const [{ tenant: slug, eventId }, query] = await Promise.all([params, searchParams]);
  const { tenant } = await requireTenantContext(decodeURIComponent(slug), "calendar.view");
  if (!uuidSchema.safeParse(eventId).success) notFound();
  const [event, members, calendars, myMemberId] = await Promise.all([
    getEvent(tenant.id, eventId),
    listMembers(tenant.id),
    listCalendars(tenant.id),
    getMyMemberId(tenant.id),
  ]);
  if (!event) notFound();

  // Gewähltes Vorkommen einer Serie (aus der Kalenderansicht), sonst der erste Termin
  const requested = typeof query.am === "string" && !Number.isNaN(Date.parse(query.am)) ? new Date(query.am).toISOString() : null;
  const duration = Date.parse(event.endsAt) - Date.parse(event.startsAt);
  const start = event.repeatFreq && requested ? requested : event.startsAt;
  const end = new Date(Date.parse(start) + duration).toISOString();
  const startLocal = utcToLocalDateTime(start, tenant.timezone);
  const endLocal = utcToLocalDateTime(end, tenant.timezone);
  const longDate = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const fmtDate = (local: string) => longDate.format(new Date(`${local.slice(0, 10)}T00:00:00Z`));
  const when = event.allDay
    ? startLocal.slice(0, 10) === addDays(endLocal.slice(0, 10), -1)
      ? `${fmtDate(startLocal)} · ganztägig`
      : `${fmtDate(startLocal)} bis ${fmtDate(`${addDays(endLocal.slice(0, 10), -1)}T00:00`)} · ganztägig`
    : startLocal.slice(0, 10) === endLocal.slice(0, 10)
      ? `${fmtDate(startLocal)}, ${startLocal.slice(11)}–${endLocal.slice(11)} Uhr`
      : `${fmtDate(startLocal)}, ${startLocal.slice(11)} Uhr bis ${fmtDate(endLocal)}, ${endLocal.slice(11)} Uhr`;

  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  const me = event.attendees.find((attendee) => attendee.memberId === myMemberId);
  const busy = event.canEdit && event.attendees.length > 0 ? await getBusy(tenant.id, event.attendees.map((a) => a.memberId), start, end) : [];
  const conflicts = new Set(
    busy.filter((slot) => slot.start !== start || slot.end !== end).map((slot) => slot.memberId),
  );
  const calendar = calendars.find((entry) => entry.id === event.calendarId);
  const repeatText = describeRepeat(event);
  const base = `${tenantBasePath(tenant.slug)}/kalender`;
  const label = (kind: string, name: string) => (kind === "personal" ? "Mein Kalender" : kind === "company" ? `Unternehmen (${name})` : `Team: ${name}`);

  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          <Link href={`${base}?datum=${startLocal.slice(0, 10)}`} className="hover:underline">
            Kalender
          </Link>
          {calendar ? ` · ${label(calendar.kind, calendar.name)}` : " · Einladung"}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm">{when}</p>
        {repeatText && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Repeat className="size-3.5" aria-hidden /> {repeatText}
          </p>
        )}
        {event.location && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {event.location}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-4">
          {me && (
            <Section title="Deine Antwort" description={`Aktuell: ${RESPONSE_LABELS[me.response]}`}>
              <RespondButtons tenantId={tenant.id} eventId={event.id} current={me.response} />
            </Section>
          )}
          {event.description && (
            <Section title="Beschreibung">
              <p className="text-sm whitespace-pre-line">{event.description}</p>
            </Section>
          )}
          <Section title={`Teilnehmende (${event.attendees.length})`}>
            {event.attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niemand eingeladen.</p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {event.attendees.map((attendee) => (
                  <li key={attendee.memberId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="truncate">{memberNames.get(attendee.memberId) ?? "Ehemaliges Mitglied"}</span>
                    <span className="flex gap-1">
                      {conflicts.has(attendee.memberId) && (
                        <Badge variant="outline" className="h-5 border-negative/40 text-[11px] text-negative">
                          Zu dieser Zeit belegt
                        </Badge>
                      )}
                      <Badge variant={attendee.response === "accepted" ? "default" : "outline"} className="h-5 text-[11px]">
                        {RESPONSE_LABELS[attendee.response]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {event.reminderMinutes !== null && <span>Erinnerung: {REMINDER_OPTIONS.find((option) => option.value === String(event.reminderMinutes))?.label ?? `${event.reminderMinutes} Minuten vorher`}</span>}
            <a href={`${base}/termine/${event.id}/ics`} className="inline-flex items-center gap-1 hover:underline" download>
              <Download className="size-3.5" aria-hidden />
              Als .ics herunterladen
            </a>
          </p>
          {event.canEdit && (
            <DeleteEventButtons tenantId={tenant.id} eventId={event.id} title={event.title} occurrence={event.repeatFreq ? startLocal.slice(0, 10) : undefined} />
          )}
        </div>
        {event.canEdit && (
          <Section title={event.repeatFreq ? "Serie bearbeiten" : "Bearbeiten"} description={event.repeatFreq ? "Änderungen gelten für alle Termine der Serie." : undefined}>
            <EventForm
              tenantId={tenant.id}
              calendars={calendars.filter((entry) => entry.canEdit).map((entry) => ({ id: entry.id, label: label(entry.kind, entry.name) }))}
              members={members.filter((member) => member.memberId !== myMemberId).map((member) => ({ id: member.memberId, label: member.email }))}
              values={{
                id: event.id,
                calendarId: event.calendarId,
                title: event.title,
                description: event.description,
                location: event.location,
                allDay: event.allDay,
                startDate: utcToLocalDateTime(event.startsAt, tenant.timezone).slice(0, 10),
                startTime: utcToLocalDateTime(event.startsAt, tenant.timezone).slice(11),
                endDate: event.allDay
                  ? addDays(utcToLocalDateTime(event.endsAt, tenant.timezone).slice(0, 10), -1)
                  : utcToLocalDateTime(event.endsAt, tenant.timezone).slice(0, 10),
                endTime: utcToLocalDateTime(event.endsAt, tenant.timezone).slice(11),
                repeatFreq: event.repeatFreq,
                repeatInterval: event.repeatInterval,
                repeatWeekdays: event.repeatWeekdays,
                repeatUntil: event.repeatUntil,
                repeatCount: event.repeatCount,
                reminderMinutes: event.reminderMinutes,
                attendees: event.attendees.map((attendee) => attendee.memberId),
              }}
            />
          </Section>
        )}
      </div>
    </>
  );
}

export default function EventPage({ params, searchParams }: PageProps<"/app/[tenant]/kalender/termine/[eventId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" role="status" aria-label="Termin wird geladen" />}>
      <EventDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
