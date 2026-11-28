import "server-only";
import { localDateTimeToUtc, utcToLocalDateTime } from "@/modules/core/domain/time-zone";
import type { IcsEvent, RepeatFrequency } from "../domain/calendar";

type Row = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  repeatFreq: RepeatFrequency | null;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
  exceptionDates: string[];
  updatedAt: string;
};

/** Termin für iCal aufbereiten: ganztägige Termine als lokale Daten, Ausnahmen als Zeitpunkte. */
export const toIcsEvent = (row: Row, timeZone: string): IcsEvent => {
  const startLocal = utcToLocalDateTime(row.startsAt, timeZone);
  const endLocal = utcToLocalDateTime(row.endsAt, timeZone);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    startDate: startLocal.slice(0, 10),
    endDate: endLocal.slice(0, 10),
    repeatFreq: row.repeatFreq,
    repeatInterval: row.repeatInterval,
    repeatWeekdays: row.repeatWeekdays,
    repeatUntil: row.repeatUntil,
    repeatCount: row.repeatCount,
    exceptions: row.exceptionDates.flatMap((date) => {
      const instant = row.allDay ? `${date}T00:00:00.000Z` : localDateTimeToUtc(`${date}T${startLocal.slice(11)}`, timeZone);
      return instant ? [instant] : [];
    }),
    updatedAt: row.updatedAt,
  };
};
