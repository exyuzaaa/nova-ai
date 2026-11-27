import { z } from "zod";

/* Fachliche Regeln des Projektmoduls (gespiegelt in den Prüfungen der Datenbank). */

export const PROJECT_STATUSES = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Geplant",
  active: "Aktiv",
  on_hold: "Pausiert",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};

export const VISIBILITIES = ["tenant", "members"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  tenant: "Alle im Unternehmen",
  members: "Nur Projektmitglieder",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { low: "Niedrig", normal: "Normal", high: "Hoch", urgent: "Dringend" };

export const STATUS_CATEGORIES = ["todo", "in_progress", "done"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];
export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = { todo: "Offen", in_progress: "In Arbeit", done: "Erledigt" };

export const PROJECT_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#64748b"] as const;

export const asProjectStatus = (value: string): ProjectStatus =>
  (PROJECT_STATUSES as readonly string[]).includes(value) ? (value as ProjectStatus) : "active";
export const asPriority = (value: string): Priority => ((PRIORITIES as readonly string[]).includes(value) ? (value as Priority) : "normal");
export const asCategory = (value: string): StatusCategory =>
  (STATUS_CATEGORIES as readonly string[]).includes(value) ? (value as StatusCategory) : "todo";

// -----------------------------------------------------------------------------
// Bausteine
// -----------------------------------------------------------------------------
const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} darf höchstens ${max} Zeichen lang sein.` })
    .transform((value) => (value === "" ? null : value));

const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.uuid().nullable());

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (value: string) => {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.string().refine(isRealDate, { error: "Bitte gib ein gültiges Datum ein." }).nullable());

/** Stunden in deutscher Schreibweise („12,5“) → Zahl oder null. */
export const parseHours = (value: string): number | null => {
  const trimmed = value.trim().replace(/\s/g, "");
  if (trimmed === "") return null;
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
};

const optionalHours = z
  .string()
  .transform(parseHours)
  .pipe(
    z
      .number({ error: "Bitte gib die Stunden als Zahl ein, z. B. 12,5." })
      .min(0, { error: "Bitte gib eine positive Zahl ein." })
      .max(99999, { error: "Die Zahl ist zu groß." })
      .nullable(),
  );

/** Dauer als „1:30“, „1,5“ (Stunden) oder „90m“ → Minuten. */
export const parseDuration = (value: string): number | null => {
  const trimmed = value.trim().toLowerCase().replace(/\s/g, "");
  if (trimmed === "") return null;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = /^(\d{1,5})(m|min)$/.exec(trimmed);
  if (minutes) return Number(minutes[1]);
  const hours = /^(\d{1,3})([.,]\d{1,2})?h?$/.exec(trimmed);
  if (hours) return Math.round(Number(`${hours[1]}${(hours[2] ?? "").replace(",", ".")}`) * 60);
  return Number.NaN;
};

/** Minuten → „1:30 h“. */
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return "–";
  const sign = minutes < 0 ? "-" : "";
  const value = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")} h`;
};

const optionalDuration = (label: string) =>
  z
    .string()
    .transform(parseDuration)
    .pipe(
      z
        .number({ error: `${label}: bitte als „1:30“, „1,5“ oder „90m“ eingeben.` })
        .int()
        .min(0, { error: `${label} darf nicht negativ sein.` })
        .max(100000, { error: `${label} ist zu groß.` })
        .nullable(),
    );

const dateRange = <T extends { start_date: string | null; due_date: string | null }>(value: T, ctx: z.RefinementCtx) => {
  if (value.start_date && value.due_date && value.due_date < value.start_date) {
    ctx.addIssue({ code: "custom", path: ["due_date"], message: "Das Enddatum liegt vor dem Startdatum." });
  }
};

// -----------------------------------------------------------------------------
// Formulare
// -----------------------------------------------------------------------------
export const projectNameSchema = z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(200, { error: "Der Name ist zu lang." });

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(200, { error: "Der Name ist zu lang." }),
    description: optional(10000, "Die Beschreibung"),
    customer_id: optionalUuid,
    status: z.enum(PROJECT_STATUSES, { error: "Bitte wähle einen Status." }),
    visibility: z.enum(VISIBILITIES, { error: "Bitte wähle, wer das Projekt sieht." }),
    color: z.string().regex(/^#[0-9a-f]{6}$/, { error: "Bitte wähle eine Farbe." }),
    start_date: optionalDate,
    due_date: optionalDate,
    budget_hours: optionalHours,
    lead_member_id: optionalUuid,
  })
  .superRefine(dateRange);
export type ProjectInput = z.infer<typeof projectSchema>;

export const quickTaskSchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein." }).max(300, { error: "Der Titel ist zu lang." }),
});

export const taskSchema = z
  .object({
    title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein." }).max(300, { error: "Der Titel ist zu lang." }),
    description: optional(20000, "Die Beschreibung"),
    status_id: z.uuid({ error: "Bitte wähle einen Status." }),
    priority: z.enum(PRIORITIES, { error: "Bitte wähle eine Priorität." }),
    assignee_member_id: optionalUuid,
    start_date: optionalDate,
    due_date: optionalDate,
    estimate_minutes: optionalDuration("Die Schätzung"),
    milestone_id: optionalUuid,
  })
  .superRefine(dateRange);
export type TaskInput = z.infer<typeof taskSchema>;

export const milestoneSchema = z.object({
  name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(200, { error: "Der Name ist zu lang." }),
  description: optional(2000, "Die Beschreibung"),
  due_date: optionalDate,
});

export const statusSchema = z.object({
  name: z.string().trim().min(1, { error: "Bitte gib einen Namen ein." }).max(60, { error: "Der Name ist zu lang." }),
  category: z.enum(STATUS_CATEGORIES, { error: "Bitte wähle eine Art." }),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, { error: "Bitte schreib einen Kommentar." }).max(10000, { error: "Der Kommentar ist zu lang." }),
});

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib einen Punkt ein." }).max(300, { error: "Der Punkt ist zu lang." }),
});

// -----------------------------------------------------------------------------
// Listen
// -----------------------------------------------------------------------------
export type ProjectListQuery = { q: string; status: ProjectStatus | "open" | "all"; mine: boolean; archived: boolean };

export const parseProjectListQuery = (raw: Record<string, string | string[] | undefined>): ProjectListQuery => {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  const status = one("status");
  return {
    q: one("q").slice(0, 100),
    status: status === "all" || (PROJECT_STATUSES as readonly string[]).includes(status) ? (status as ProjectStatus | "all") : "open",
    mine: one("meine") === "1",
    archived: one("archiv") === "1",
  };
};

export type TaskListQuery = { q: string; assignee: "me" | "none" | "all" | string; done: boolean };

export const parseTaskListQuery = (raw: Record<string, string | string[] | undefined>): TaskListQuery => {
  const one = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : "");
  const assignee = one("zustaendig");
  return {
    q: one("q").slice(0, 100),
    assignee: assignee === "me" || assignee === "none" || z.uuid().safeParse(assignee).success ? assignee : "all",
    done: one("erledigt") === "1",
  };
};

/** Fortschritt in Prozent (erledigte von allen Aufgaben, ohne Unteraufgaben). */
export const progress = (done: number, total: number): number => (total === 0 ? 0 : Math.round((done / total) * 100));

/** Fälligkeit relativ zu „heute“ (Datum in der Zeitzone des Unternehmens). */
export const dueState = (dueDate: string | null, today: string, completed: boolean): "overdue" | "today" | "upcoming" | null => {
  if (!dueDate || completed) return null;
  if (dueDate < today) return "overdue";
  return dueDate === today ? "today" : "upcoming";
};

/** Heutiges Datum (YYYY-MM-DD) in einer Zeitzone. */
export const todayIn = (timeZone: string, now = new Date()): string => new Intl.DateTimeFormat("sv-SE", { timeZone }).format(now);

// -----------------------------------------------------------------------------
// Zeiterfassung
// -----------------------------------------------------------------------------
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Zeiteintrag aus dem Formular: Datum + Beginn und entweder Ende oder Dauer.
 * Ergebnis in Ortszeit („YYYY-MM-DDTHH:MM“); die Umrechnung nach UTC erfolgt mit der
 * Zeitzone des Unternehmens im Server.
 */
export const timeEntrySchema = z
  .object({
    date: z.string().trim().refine(isRealDate, { error: "Bitte gib ein gültiges Datum ein." }),
    start: z.string().trim().regex(TIME, { error: "Bitte gib den Beginn als Uhrzeit ein, z. B. 08:30." }),
    end: z.string().trim(),
    duration: z.string().trim(),
    note: optional(1000, "Die Notiz"),
    billable: z.boolean(),
    task_id: optionalUuid,
  })
  .transform((value, ctx) => {
    const [hours, minutes] = value.start.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    let length: number | null = null;
    if (value.end !== "") {
      if (!TIME.test(value.end)) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "Bitte gib das Ende als Uhrzeit ein, z. B. 17:00." });
        return z.NEVER;
      }
      const [endHours, endMinutes] = value.end.split(":").map(Number);
      length = endHours * 60 + endMinutes - startMinutes;
      if (length <= 0) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "Das Ende muss nach dem Beginn liegen." });
        return z.NEVER;
      }
    } else {
      length = parseDuration(value.duration);
      if (length === null || Number.isNaN(length) || length <= 0) {
        ctx.addIssue({ code: "custom", path: ["duration"], message: "Bitte gib ein Ende oder eine Dauer ein, z. B. 1:30." });
        return z.NEVER;
      }
    }
    if (length > 24 * 60) {
      ctx.addIssue({ code: "custom", path: ["duration"], message: "Ein Eintrag darf höchstens 24 Stunden lang sein." });
      return z.NEVER;
    }
    return {
      startLocal: `${value.date}T${value.start}`,
      minutes: length,
      note: value.note,
      billable: value.billable,
      task_id: value.task_id,
    };
  });
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

/** Montag der Woche eines Datums (YYYY-MM-DD). */
export const weekStart = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
};

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Monat „YYYY-MM“ aus der Adresse oder der aktuelle. */
export const parseMonth = (value: unknown, today: string): string =>
  typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : today.slice(0, 7);

export const monthRange = (month: string): { from: string; to: string } => {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
};

export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNumber] = month.split("-").map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

// -----------------------------------------------------------------------------
// Zeitleiste
// -----------------------------------------------------------------------------
export type TimelineItem = { id: string; start: string | null; end: string | null };

/** Sichtbarer Zeitraum der Zeitleiste: vom frühesten bis zum spätesten Termin, auf Wochen gerundet, max. 52 Wochen. */
export const timelineRange = (items: TimelineItem[], fallbackStart: string): { from: string; weeks: number } => {
  const dates = items.flatMap((item) => [item.start, item.end]).filter((value): value is string => Boolean(value)).sort();
  const first = weekStart(dates[0] ?? fallbackStart);
  const last = dates.at(-1) ?? fallbackStart;
  const days = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000) + 1;
  return { from: first, weeks: Math.min(52, Math.max(4, Math.ceil(days / 7))) };
};

/** Position eines Balkens in Prozent (links, Breite) innerhalb des Zeitraums. */
export const timelineBar = (item: TimelineItem, from: string, weeks: number): { left: number; width: number } | null => {
  const start = item.start ?? item.end;
  const end = item.end ?? item.start;
  if (!start || !end) return null;
  const total = weeks * 7;
  const offset = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  const left = Math.max(0, Math.min(total, offset(start)));
  const right = Math.max(left, Math.min(total, offset(end) + 1));
  if (offset(end) < 0 || offset(start) >= total) return null;
  return { left: (left / total) * 100, width: Math.max(((right - left) / total) * 100, 0.8) };
};
