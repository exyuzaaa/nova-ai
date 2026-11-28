import { z } from "zod";

/* Fachliche Regeln des Kalenders: Formular, Ansichten, Wiederholungen, iCal. */

export const REPEAT_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
export type RepeatFrequency = (typeof REPEAT_FREQUENCIES)[number];
export const REPEAT_LABELS: Record<RepeatFrequency, string> = { daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich", yearly: "Jährlich" };
export const REPEAT_UNITS: Record<RepeatFrequency, [string, string]> = {
  daily: ["Tag", "Tage"],
  weekly: ["Woche", "Wochen"],
  monthly: ["Monat", "Monate"],
  yearly: ["Jahr", "Jahre"],
};
export const WEEKDAYS = [
  { value: 1, short: "Mo", long: "Montag" },
  { value: 2, short: "Di", long: "Dienstag" },
  { value: 3, short: "Mi", long: "Mittwoch" },
  { value: 4, short: "Do", long: "Donnerstag" },
  { value: 5, short: "Fr", long: "Freitag" },
  { value: 6, short: "Sa", long: "Samstag" },
  { value: 7, short: "So", long: "Sonntag" },
] as const;
export const REMINDER_OPTIONS = [
  { value: "", label: "Keine Erinnerung" },
  { value: "0", label: "Zum Beginn" },
  { value: "5", label: "5 Minuten vorher" },
  { value: "15", label: "15 Minuten vorher" },
  { value: "30", label: "30 Minuten vorher" },
  { value: "60", label: "1 Stunde vorher" },
  { value: "1440", label: "1 Tag vorher" },
] as const;
export const RESPONSE_LABELS = { pending: "Offen", accepted: "Zugesagt", tentative: "Vielleicht", declined: "Abgesagt" } as const;
export type Response = keyof typeof RESPONSE_LABELS;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isIsoDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const isoWeekday = (isoDate: string) => ((new Date(`${isoDate}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
export const weekStart = (isoDate: string) => addDays(isoDate, 1 - isoWeekday(isoDate));

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} darf höchstens ${max} Zeichen lang sein.` })
    .transform((value) => (value === "" ? null : value));

/**
 * Termin aus dem Formular. Zeiten sind Ortszeit des Unternehmens; Ergebnis:
 * Beginn/Ende als „YYYY-MM-DDTHH:MM“ (ganztägig: Ende = Folgetag 00:00, exklusiv).
 */
export const eventSchema = z
  .object({
    calendar_id: z.uuid({ error: "Bitte wähle einen Kalender." }),
    title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein." }).max(200, { error: "Der Titel ist zu lang." }),
    description: optional(5000, "Die Beschreibung"),
    location: optional(300, "Der Ort"),
    all_day: z.boolean(),
    start_date: z.string().refine(isIsoDate, { error: "Bitte gib ein gültiges Datum ein." }),
    start_time: z.string(),
    end_date: z.string().refine(isIsoDate, { error: "Bitte gib ein gültiges Datum ein." }),
    end_time: z.string(),
    repeat: z.enum(["none", ...REPEAT_FREQUENCIES], { error: "Bitte wähle eine Wiederholung." }),
    repeat_interval: z.coerce.number({ error: "Bitte gib eine Zahl ein." }).int().min(1, { error: "Mindestens 1." }).max(99, { error: "Höchstens 99." }),
    repeat_weekdays: z.array(z.coerce.number().int().min(1).max(7)).max(7),
    repeat_end: z.enum(["never", "until", "count"]),
    repeat_until: z.string(),
    repeat_count: z.string(),
    reminder_minutes: z.string(),
    attendees: z.array(z.uuid()).max(50, { error: "Höchstens 50 Personen." }),
  })
  .transform((value, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    let startLocal: string;
    let endLocal: string;
    if (value.all_day) {
      if (value.end_date < value.start_date) return issue("end_date", "Das Ende liegt vor dem Beginn.");
      startLocal = `${value.start_date}T00:00`;
      endLocal = `${addDays(value.end_date, 1)}T00:00`;
    } else {
      if (!TIME.test(value.start_time)) return issue("start_time", "Bitte gib eine Uhrzeit ein, z. B. 09:00.");
      if (!TIME.test(value.end_time)) return issue("end_time", "Bitte gib eine Uhrzeit ein, z. B. 10:00.");
      startLocal = `${value.start_date}T${value.start_time}`;
      endLocal = `${value.end_date}T${value.end_time}`;
      if (endLocal <= startLocal) return issue("end_time", "Das Ende muss nach dem Beginn liegen.");
    }
    const days = (Date.parse(`${endLocal}:00Z`) - Date.parse(`${startLocal}:00Z`)) / 86400000;
    if (days > 31) return issue("end_date", "Ein Termin darf höchstens 31 Tage dauern.");

    const repeating = value.repeat !== "none";
    let repeatUntil: string | null = null;
    let repeatCount: number | null = null;
    if (repeating && value.repeat_end === "until") {
      if (!isIsoDate(value.repeat_until)) return issue("repeat_until", "Bitte gib ein gültiges Enddatum ein.");
      if (value.repeat_until < value.start_date) return issue("repeat_until", "Das Ende der Serie liegt vor dem ersten Termin.");
      repeatUntil = value.repeat_until;
    }
    if (repeating && value.repeat_end === "count") {
      const count = Number(value.repeat_count);
      if (!Number.isInteger(count) || count < 1 || count > 500) return issue("repeat_count", "Bitte gib eine Anzahl zwischen 1 und 500 ein.");
      repeatCount = count;
    }
    const reminder = value.reminder_minutes === "" ? null : Number(value.reminder_minutes);
    if (reminder !== null && (!Number.isInteger(reminder) || reminder < 0 || reminder > 40320)) return issue("reminder_minutes", "Ungültige Erinnerung.");

    return {
      calendar_id: value.calendar_id,
      title: value.title,
      description: value.description,
      location: value.location,
      all_day: value.all_day,
      startLocal,
      endLocal,
      repeat_freq: repeating ? (value.repeat as RepeatFrequency) : null,
      repeat_interval: repeating ? value.repeat_interval : 1,
      repeat_weekdays: repeating && value.repeat === "weekly" ? [...new Set(value.repeat_weekdays)].sort() : [],
      repeat_until: repeatUntil,
      repeat_count: repeatCount,
      reminder_minutes: reminder,
      attendees: [...new Set(value.attendees)],
    };
  });
export type EventInput = z.infer<typeof eventSchema>;

/** Wiederholung in Worten, z. B. „Alle 2 Wochen am Mo, Mi · 5-mal“. */
export const describeRepeat = (event: {
  repeatFreq: RepeatFrequency | null;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
}): string | null => {
  if (!event.repeatFreq) return null;
  const [, many] = REPEAT_UNITS[event.repeatFreq];
  let text = event.repeatInterval === 1 ? REPEAT_LABELS[event.repeatFreq] : `Alle ${event.repeatInterval} ${many}`;
  if (event.repeatFreq === "weekly" && event.repeatWeekdays.length > 0) {
    text += ` am ${event.repeatWeekdays.map((day) => WEEKDAYS[day - 1].short).join(", ")}`;
  }
  if (event.repeatUntil) {
    const [year, month, day] = event.repeatUntil.split("-");
    text += ` · bis ${day}.${month}.${year}`;
  }
  if (event.repeatCount) text += ` · ${event.repeatCount}-mal`;
  return text;
};

// -----------------------------------------------------------------------------
// Ansichten
// -----------------------------------------------------------------------------
export const VIEWS = ["monat", "woche", "liste"] as const;
export type View = (typeof VIEWS)[number];

export const parseView = (raw: Record<string, string | string[] | undefined>, today: string): { view: View; date: string } => {
  const view = typeof raw.ansicht === "string" && (VIEWS as readonly string[]).includes(raw.ansicht) ? (raw.ansicht as View) : "monat";
  const date = typeof raw.datum === "string" && isIsoDate(raw.datum) ? raw.datum : today;
  return { view, date };
};

/** Sichtbarer Bereich [from, to) als lokale Daten für eine Ansicht. */
export const viewRange = (view: View, date: string): { from: string; to: string } => {
  if (view === "woche") {
    const from = weekStart(date);
    return { from, to: addDays(from, 7) };
  }
  if (view === "liste") return { from: date, to: addDays(date, 30) };
  const first = `${date.slice(0, 7)}-01`;
  const from = weekStart(first);
  const nextMonth = addDays(first, 32).slice(0, 7);
  const lastDay = addDays(`${nextMonth}-01`, -1);
  return { from, to: addDays(weekStart(lastDay), 7) };
};

export const shiftView = (view: View, date: string, direction: 1 | -1): string => {
  if (view === "woche") return addDays(date, 7 * direction);
  if (view === "liste") return addDays(date, 30 * direction);
  const [year, month] = date.split("-").map(Number);
  const index = year * 12 + (month - 1) + direction;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
};

// -----------------------------------------------------------------------------
// iCal (RFC 5545)
// -----------------------------------------------------------------------------
export type IcsEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  /** Lokale Daten bei ganztägigen Terminen (YYYY-MM-DD, Ende exklusiv). */
  startDate?: string;
  endDate?: string;
  repeatFreq: RepeatFrequency | null;
  repeatInterval: number;
  repeatWeekdays: number[];
  repeatUntil: string | null;
  repeatCount: number | null;
  /** Ausnahmen als UTC-Zeitpunkte des jeweiligen Vorkommens. */
  exceptions: string[];
  updatedAt: string;
};

export const escapeIcsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateStamp = (isoDate: string) => isoDate.replace(/-/g, "");

/** Zeilen über 75 Byte falten (Fortsetzung beginnt mit Leerzeichen). */
export const foldIcsLine = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export const buildIcs = (calendarName: string, events: IcsEvent[], host = "nova"): string => {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NOVA//Kalender//DE", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcsText(calendarName)}`];
  const now = utcStamp(new Date().toISOString());
  for (const event of events) {
    lines.push("BEGIN:VEVENT", `UID:${event.id}@${host}`, `DTSTAMP:${now}`, `LAST-MODIFIED:${utcStamp(event.updatedAt)}`);
    if (event.allDay && event.startDate && event.endDate) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.startDate)}`, `DTEND;VALUE=DATE:${dateStamp(event.endDate)}`);
    } else {
      lines.push(`DTSTART:${utcStamp(event.startsAt)}`, `DTEND:${utcStamp(event.endsAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.repeatFreq) {
      const rule = [`FREQ=${event.repeatFreq.toUpperCase()}`];
      if (event.repeatInterval > 1) rule.push(`INTERVAL=${event.repeatInterval}`);
      if (event.repeatFreq === "weekly" && event.repeatWeekdays.length > 0) rule.push(`BYDAY=${event.repeatWeekdays.map((day) => BYDAY[day - 1]).join(",")}`);
      if (event.repeatUntil) rule.push(`UNTIL=${dateStamp(event.repeatUntil)}T235959Z`);
      if (event.repeatCount) rule.push(`COUNT=${event.repeatCount}`);
      lines.push(`RRULE:${rule.join(";")}`);
      for (const exception of event.exceptions) {
        lines.push(event.allDay ? `EXDATE;VALUE=DATE:${dateStamp(exception.slice(0, 10))}` : `EXDATE:${utcStamp(exception)}`);
      }
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};
