import "server-only";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { listMembers } from "@/modules/core/server/tenants";
import { CUSTOMER_KIND_LABELS, CUSTOMER_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "../domain/crm";
import { toCsv } from "../domain/csv";

/** Höchstzahl exportierter Zeilen je Datei (Schutz vor sehr großen Antworten). */
export const EXPORT_LIMIT = 50_000;
const CHUNK = 1000;

const db = async () => crmSchema(await createSupabaseServerClient());

const label = <T extends string>(labels: Record<T, string>, value: string) => labels[value as T] ?? value;
const decimal = (value: number | string | null) => (value === null ? "" : Number(value).toFixed(2).replace(".", ","));

const dateTime = (timeZone: string) => {
  const format = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return (value: string | null) => (value ? format.format(new Date(value)) : "");
};

/** Alle Zeilen seitenweise laden (PostgREST liefert höchstens 1000 je Anfrage). */
const fetchAll = async <T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; from < EXPORT_LIMIT; from += CHUNK) {
    const { data, error } = await load(from, Math.min(from + CHUNK, EXPORT_LIMIT) - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < CHUNK) break;
  }
  return rows;
};

/** Kundenexport; die Spaltennamen passen zum Import, damit sich Dateien wieder einlesen lassen. */
export const exportCustomers = async (tenantId: string, timeZone: string): Promise<{ csv: string; rows: number }> => {
  const client = await db();
  const [rows, members] = await Promise.all([
    fetchAll((from, to) =>
      client
        .from("customers")
        .select(
          "number, kind, name, email, phone, website, vat_id, street, postal_code, city, country_code, status, category, tags, description, owner_member_id, created_at, archived_at",
        )
        .eq("tenant_id", tenantId)
        .order("number")
        .range(from, to),
    ),
    listMembers(tenantId),
  ]);
  const owners = new Map(members.map((member) => [member.memberId, member.email]));
  const format = dateTime(timeZone);
  const csv = toCsv(
    [
      "Kundennummer",
      "Art",
      "Name",
      "E-Mail",
      "Telefon",
      "Website",
      "USt-IdNr.",
      "Straße",
      "PLZ",
      "Ort",
      "Land",
      "Status",
      "Kategorie",
      "Schlagwörter",
      "Beschreibung",
      "Zuständig",
      "Angelegt",
      "Archiviert",
    ],
    rows.map((row) => [
      row.number,
      label(CUSTOMER_KIND_LABELS, row.kind),
      row.name,
      row.email,
      row.phone,
      row.website,
      row.vat_id,
      row.street,
      row.postal_code,
      row.city,
      row.country_code,
      label(CUSTOMER_STATUS_LABELS, row.status),
      row.category,
      row.tags.join(", "),
      row.description,
      row.owner_member_id ? owners.get(row.owner_member_id) : "",
      format(row.created_at),
      format(row.archived_at),
    ]),
  );
  return { csv, rows: rows.length };
};

export const exportLeads = async (tenantId: string, timeZone: string): Promise<{ csv: string; rows: number }> => {
  const client = await db();
  const [rows, members] = await Promise.all([
    fetchAll((from, to) =>
      client
        .from("leads")
        .select(
          "number, title, company_name, contact_name, email, phone, source, status, score, estimated_value, owner_member_id, follow_up_at, notes, created_at",
        )
        .eq("tenant_id", tenantId)
        .order("number")
        .range(from, to),
    ),
    listMembers(tenantId),
  ]);
  const owners = new Map(members.map((member) => [member.memberId, member.email]));
  const format = dateTime(timeZone);
  const csv = toCsv(
    [
      "Leadnummer",
      "Titel",
      "Firma",
      "Ansprechpartner",
      "E-Mail",
      "Telefon",
      "Quelle",
      "Status",
      "Bewertung",
      "Geschätzter Wert (EUR)",
      "Zuständig",
      "Wiedervorlage",
      "Notizen",
      "Angelegt",
    ],
    rows.map((row) => [
      row.number,
      row.title,
      row.company_name,
      row.contact_name,
      row.email,
      row.phone,
      label(LEAD_SOURCE_LABELS, row.source),
      label(LEAD_STATUS_LABELS, row.status),
      row.score,
      decimal(row.estimated_value),
      row.owner_member_id ? owners.get(row.owner_member_id) : "",
      format(row.follow_up_at),
      row.notes,
      format(row.created_at),
    ]),
  );
  return { csv, rows: rows.length };
};

/** Export im Protokoll festhalten (wirft, wenn das Recht fehlt). */
export const logExport = async (tenantId: string, kind: "customers" | "leads", rows: number) => {
  const { error } = await (await db()).rpc("log_export", { p_tenant: tenantId, p_kind: kind, p_rows: rows });
  if (error) throw error;
};
