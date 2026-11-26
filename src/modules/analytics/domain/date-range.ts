/**
 * Zeiträume & Vergleichszeiträume.
 * Alle Datumswerte sind ISO-Kalendertage (YYYY-MM-DD) in der Zeitzone der Website.
 * Rechnen erfolgt in UTC, damit Sommer-/Winterzeit keine Tage verschiebt.
 */

export const RANGE_PRESETS = ["7d", "28d", "90d", "mtd", "last_month", "12m"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const COMPARE_MODES = ["previous", "year", "none"] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export type Granularity = "day" | "week" | "month";

export type IsoDate = string;

export type DateRange = { start: IsoDate; end: IsoDate };

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  "7d": "Letzte 7 Tage",
  "28d": "Letzte 28 Tage",
  "90d": "Letzte 90 Tage",
  mtd: "Dieser Monat",
  last_month: "Letzter Monat",
  "12m": "Letzte 12 Monate",
};

export const COMPARE_MODE_LABELS: Record<CompareMode, string> = {
  previous: "Vorheriger Zeitraum",
  year: "Vorjahr",
  none: "Kein Vergleich",
};

export const DEFAULT_PRESET: RangePreset = "28d";
export const DEFAULT_COMPARE: CompareMode = "previous";

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const toUtc = (iso: IsoDate): Date => {
  if (!ISO_DATE.test(iso)) throw new RangeError(`Ungültiges Datum: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
};

const fromUtc = (date: Date): IsoDate => date.toISOString().slice(0, 10);

export const addDays = (iso: IsoDate, days: number): IsoDate =>
  fromUtc(new Date(toUtc(iso).getTime() + days * DAY_MS));

/** Anzahl Tage inklusive Start und Ende. */
export const rangeLength = ({ start, end }: DateRange): number =>
  Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / DAY_MS) + 1;

export const enumerateDays = (range: DateRange): IsoDate[] => {
  const length = rangeLength(range);
  return Array.from({ length }, (_, index) => addDays(range.start, index));
};

const startOfMonth = (iso: IsoDate): IsoDate => `${iso.slice(0, 7)}-01`;

const addMonths = (iso: IsoDate, months: number): IsoDate => {
  const date = toUtc(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return fromUtc(new Date(Date.UTC(year, month, day)));
};

/** Heutiger Kalendertag in einer IANA-Zeitzone. */
export const todayInTimeZone = (timeZone: string, now: Date): IsoDate => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

/** Zeitraum eines Presets. "Heute" zählt mit, weil Daten des laufenden Tags live sind. */
export const resolveRange = (preset: RangePreset, today: IsoDate): DateRange => {
  switch (preset) {
    case "7d":
      return { start: addDays(today, -6), end: today };
    case "28d":
      return { start: addDays(today, -27), end: today };
    case "90d":
      return { start: addDays(today, -89), end: today };
    case "mtd":
      return { start: startOfMonth(today), end: today };
    case "last_month": {
      const start = addMonths(startOfMonth(today), -1);
      return { start, end: addDays(startOfMonth(today), -1) };
    }
    case "12m":
      return { start: addDays(addMonths(today, -12), 1), end: today };
  }
};

/**
 * Vergleichszeitraum.
 * previous = gleich langer, unmittelbar vorangehender Zeitraum (Architektur §2.6).
 * year     = dieselben Kalendertage ein Jahr früher (29.02. → 28.02.).
 */
export const compareRange = (range: DateRange, mode: CompareMode): DateRange | null => {
  if (mode === "none") return null;
  if (mode === "year") {
    return { start: addMonths(range.start, -12), end: addMonths(range.end, -12) };
  }
  const length = rangeLength(range);
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) };
};

export const granularityFor = (range: DateRange): Granularity => {
  const length = rangeLength(range);
  if (length <= 92) return "day";
  if (length <= 190) return "week";
  return "month";
};

/** Beginn des Buckets, in den ein Tag fällt (Woche beginnt montags, ISO 8601). */
export const bucketStart = (iso: IsoDate, granularity: Granularity): IsoDate => {
  if (granularity === "day") return iso;
  if (granularity === "month") return startOfMonth(iso);
  const weekday = (toUtc(iso).getUTCDay() + 6) % 7; // Montag = 0
  return addDays(iso, -weekday);
};

export type Bucket = { key: IsoDate; range: DateRange };

/** Zerlegt einen Zeitraum in Buckets; Rand-Buckets werden auf den Zeitraum gekürzt. */
export const bucketsFor = (range: DateRange, granularity: Granularity): Bucket[] => {
  const buckets = new Map<IsoDate, DateRange>();
  for (const day of enumerateDays(range)) {
    const key = bucketStart(day, granularity);
    const existing = buckets.get(key);
    buckets.set(key, existing ? { start: existing.start, end: day } : { start: day, end: day });
  }
  return Array.from(buckets, ([key, bucketRange]) => ({ key, range: bucketRange }));
};

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

type SearchParamValue = string | string[] | undefined;

const firstValue = (value: SearchParamValue): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export type DashboardFilters = { preset: RangePreset; compare: CompareMode };

/** Liest Filter aus der URL; ungültige Werte fallen auf sichere Standardwerte zurück. */
export const parseDashboardFilters = (
  searchParams: Record<string, SearchParamValue>,
): DashboardFilters => {
  const preset = firstValue(searchParams.range);
  const compare = firstValue(searchParams.compare);
  return {
    preset: isOneOf(RANGE_PRESETS, preset) ? preset : DEFAULT_PRESET,
    compare: isOneOf(COMPARE_MODES, compare) ? compare : DEFAULT_COMPARE,
  };
};
