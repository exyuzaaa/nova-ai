/**
 * CSV für Import und Export (Excel-kompatibel: Semikolon, UTF-8 mit BOM, CRLF).
 * Beim Export werden Zellen, die mit = + - @ beginnen, entschärft, damit Tabellen-
 * programme sie nicht als Formel ausführen (CSV-/Formel-Injection).
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export const escapeCsvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (header: string[], rows: (string | number | null | undefined)[][]): string =>
  "﻿" + [header, ...rows].map((row) => row.map(escapeCsvCell).join(";")).join("\r\n") + "\r\n";

/** Trennzeichen anhand der Kopfzeile erkennen (außerhalb von Anführungszeichen). */
export const detectDelimiter = (text: string): ";" | "," | "\t" => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as keyof typeof counts] += 1;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as ";" | "," | "\t") ?? ";";
};

/** CSV nach RFC 4180 lesen (Anführungszeichen, verdoppelte Anführungszeichen, Zeilenumbrüche in Zellen). */
export const parseCsv = (input: string, maxRows = 5000): { header: string[]; rows: string[][]; truncated: boolean } => {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  let truncated = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      record.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(cell);
      cell = "";
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
      if (records.length > maxRows) {
        truncated = true;
        break;
      }
    } else {
      cell += char;
    }
  }
  if (!truncated && (cell !== "" || record.length > 0)) {
    record.push(cell);
    if (record.some((value) => value.trim() !== "")) records.push(record);
  }
  const [header = [], ...rows] = records;
  return {
    header: header.map((value) => value.trim()),
    rows: rows.slice(0, maxRows),
    truncated: truncated || rows.length > maxRows,
  };
};

// -----------------------------------------------------------------------------
// Feldzuordnung für den Kundenimport
// -----------------------------------------------------------------------------
export const CUSTOMER_IMPORT_FIELDS = [
  {
    key: "name",
    label: "Name",
    aliases: ["name", "firma", "firmenname", "kunde", "kundenname", "unternehmen", "company"],
  },
  {
    key: "kind",
    label: "Art (Firma/Privat)",
    aliases: ["art", "typ", "kundenart", "type"],
  },
  {
    key: "email",
    label: "E-Mail-Adresse",
    aliases: ["e-mail", "email", "mail", "e-mail-adresse"],
  },
  {
    key: "phone",
    label: "Telefon",
    aliases: ["telefon", "telefonnummer", "tel", "phone"],
  },
  {
    key: "website",
    label: "Website",
    aliases: ["website", "webseite", "homepage", "web", "url"],
  },
  {
    key: "vat_id",
    label: "USt-IdNr.",
    aliases: ["ust-idnr", "ust-idnr.", "ust-id", "umsatzsteuer-id", "ustid", "vat", "vat id"],
  },
  {
    key: "street",
    label: "Straße",
    aliases: ["straße", "strasse", "str", "adresse", "anschrift", "street"],
  },
  {
    key: "postal_code",
    label: "PLZ",
    aliases: ["plz", "postleitzahl", "zip", "postal code"],
  },
  { key: "city", label: "Ort", aliases: ["ort", "stadt", "city"] },
  {
    key: "country_code",
    label: "Land",
    aliases: ["land", "country", "ländercode"],
  },
  { key: "status", label: "Status", aliases: ["status"] },
  {
    key: "category",
    label: "Kategorie",
    aliases: ["kategorie", "branche", "category"],
  },
  {
    key: "tags",
    label: "Schlagwörter",
    aliases: ["schlagwörter", "schlagworte", "tags", "stichwörter"],
  },
  {
    key: "description",
    label: "Beschreibung",
    aliases: ["beschreibung", "notiz", "notizen", "bemerkung", "description"],
  },
] as const;
export type CustomerImportField = (typeof CUSTOMER_IMPORT_FIELDS)[number]["key"];

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Spalten automatisch zuordnen: Index der CSV-Spalte je Feld (oder -1). */
export const guessMapping = (header: string[]): Record<CustomerImportField, number> => {
  const normalized = header.map(normalizeHeader);
  return Object.fromEntries(
    CUSTOMER_IMPORT_FIELDS.map((field) => [
      field.key,
      normalized.findIndex((value) => (field.aliases as readonly string[]).includes(value)),
    ]),
  ) as Record<CustomerImportField, number>;
};

const COUNTRY_NAMES: Record<string, string> = {
  deutschland: "DE",
  germany: "DE",
  österreich: "AT",
  oesterreich: "AT",
  austria: "AT",
  schweiz: "CH",
  switzerland: "CH",
  niederlande: "NL",
  frankreich: "FR",
  italien: "IT",
  spanien: "ES",
  polen: "PL",
  belgien: "BE",
  luxemburg: "LU",
  dänemark: "DK",
};

export const normalizeCountry = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === "") return "DE";
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return COUNTRY_NAMES[trimmed.toLowerCase()] ?? trimmed;
};

export const normalizeStatus = (value: string): string => {
  const lower = value.trim().toLowerCase();
  if (["interessent", "prospect", "potenziell"].includes(lower)) return "prospect";
  if (["inaktiv", "inactive", "ehemalig"].includes(lower)) return "inactive";
  return lower === "" || ["aktiv", "active", "kunde"].includes(lower) ? "active" : lower;
};

export const normalizeKind = (value: string): string => {
  const lower = value.trim().toLowerCase();
  if (["privat", "privatperson", "person", "privatkunde"].includes(lower)) return "person";
  return lower === "" || ["firma", "unternehmen", "company", "geschäftskunde"].includes(lower) ? "company" : lower;
};

/** Eine CSV-Zeile anhand der Zuordnung in Formularwerte für customerSchema übersetzen. */
export const rowToCustomerInput = (row: string[], mapping: Record<CustomerImportField, number>): Record<string, string> => {
  // Beim Export entschärfte Formelzeichen ('=…, '+49…) wieder zurückverwandeln
  const pick = (field: CustomerImportField) => (mapping[field] >= 0 ? (row[mapping[field]] ?? "").trim().replace(/^'(?=[=+\-@])/, "") : "");
  return {
    kind: normalizeKind(pick("kind")),
    name: pick("name"),
    email: pick("email"),
    phone: pick("phone"),
    website: pick("website"),
    vat_id: pick("vat_id").replace(/\s+/g, "").toUpperCase(),
    street: pick("street"),
    postal_code: pick("postal_code"),
    city: pick("city"),
    country_code: normalizeCountry(pick("country_code")),
    status: normalizeStatus(pick("status")),
    category: pick("category"),
    tags: pick("tags").replace(/[|/]/g, ","),
    description: pick("description"),
    owner_member_id: "",
  };
};
