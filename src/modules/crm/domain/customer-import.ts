import { CUSTOMER_IMPORT_FIELDS } from "./csv";
import { customerSchema, type CustomerInput } from "./crm";

/** Höchstzahl Zeilen je Import (größere Dateien bitte aufteilen). */
export const MAX_IMPORT_ROWS = 2000;
/** Höchstgröße der hochgeladenen Datei. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportRowError = { row: number; messages: string[] };
export type ImportDuplicate = { row: number; reason: string };

const FIELD_LABELS: Record<string, string> = Object.fromEntries(CUSTOMER_IMPORT_FIELDS.map((field) => [field.key, field.label]));

/** Zeilennummer in der Datei: Kopfzeile ist Zeile 1. */
export const fileRow = (index: number) => index + 2;

/**
 * Importzeilen prüfen: Formularregeln wie beim Anlegen von Hand und Dubletten
 * innerhalb der Datei (gleicher Name oder gleiche E-Mail-Adresse).
 */
export const evaluateImportRows = (rows: Record<string, string>[]) => {
  const valid: { index: number; data: CustomerInput }[] = [];
  const errors: ImportRowError[] = [];
  const duplicates: ImportDuplicate[] = [];
  const seenNames = new Map<string, number>();
  const seenEmails = new Map<string, number>();

  rows.forEach((row, index) => {
    const parsed = customerSchema.safeParse(row);
    if (!parsed.success) {
      errors.push({
        row: fileRow(index),
        messages: parsed.error.issues.map((issue) => {
          const field = String(issue.path[0] ?? "");
          return FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${issue.message}` : issue.message;
        }),
      });
      return;
    }
    const name = parsed.data.name.toLowerCase();
    const email = parsed.data.email?.toLowerCase();
    const earlier = seenNames.get(name) ?? (email ? seenEmails.get(email) : undefined);
    if (earlier !== undefined) {
      duplicates.push({
        row: fileRow(index),
        reason: `wie Zeile ${fileRow(earlier)} in dieser Datei`,
      });
    }
    if (!seenNames.has(name)) seenNames.set(name, index);
    if (email && !seenEmails.has(email)) seenEmails.set(email, index);
    valid.push({ index, data: parsed.data });
  });

  return { valid, errors, duplicates };
};
