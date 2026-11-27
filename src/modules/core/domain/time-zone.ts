/**
 * Umrechnung zwischen Ortszeit eines Unternehmens (IANA-Zeitzone) und UTC.
 * Eingaben aus <input type="datetime-local"> haben keine Zeitzone – sie gelten
 * in der Zeitzone des Unternehmens, nicht in der des Servers.
 */
const offsetMs = (timestamp: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - timestamp;
};

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const isLocalDateTime = (value: string): boolean => LOCAL_PATTERN.test(value);

/** "2026-12-01T10:00" in Europe/Berlin → "2026-12-01T09:00:00.000Z" */
export const localDateTimeToUtc = (local: string, timeZone: string): string | null => {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - offsetMs(guess, timeZone);
  const corrected = guess - offsetMs(result, timeZone);
  if (corrected !== result) result = corrected;
  const date = new Date(result);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** UTC-Zeitpunkt → Wert für <input type="datetime-local"> in der Zeitzone des Unternehmens. */
export const utcToLocalDateTime = (iso: string, timeZone: string): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const local = new Date(timestamp + offsetMs(timestamp, timeZone));
  return local.toISOString().slice(0, 16);
};
