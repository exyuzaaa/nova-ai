"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { databaseMessage, FORBIDDEN, GENERIC_ERROR } from "@/modules/core/server/action-state";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { evaluateImportRows, fileRow, MAX_IMPORT_ROWS, type ImportDuplicate, type ImportRowError } from "../../domain/customer-import";

/* Kundenimport aus CSV (Recht crm.manage). Die Datei wird im Browser gelesen und
   zugeordnet; hier wird jede Zeile erneut geprüft, bevor etwas gespeichert wird. */

export type ImportResult = {
  status: "idle" | "error" | "checked" | "imported";
  message?: string;
  total: number;
  valid: number;
  errors: ImportRowError[];
  duplicates: ImportDuplicate[];
  created?: number;
  skipped?: number;
};

const requestSchema = z.object({
  tenantId: z.uuid(),
  mode: z.enum(["check", "import"]),
  skipDuplicates: z.boolean(),
  rows: z
    .array(z.record(z.string(), z.string().max(10_000)))
    .min(1)
    .max(MAX_IMPORT_ROWS),
});

const CHUNK = 250;
const empty = (message: string): ImportResult => ({
  status: "error",
  message,
  total: 0,
  valid: 0,
  errors: [],
  duplicates: [],
});

export async function importCustomersAction(input: z.input<typeof requestSchema>): Promise<ImportResult> {
  await requireUser();
  const request = requestSchema.safeParse(input);
  if (!request.success) return empty(`Die Datei ist leer oder hat mehr als ${MAX_IMPORT_ROWS} Zeilen.`);
  const tenant = await getTenantWithPermission(request.data.tenantId, "crm.manage");
  if (!tenant) return empty(FORBIDDEN);

  const { rows, mode, skipDuplicates } = request.data;
  const { valid, errors, duplicates } = evaluateImportRows(rows);
  const client = crmSchema(await createSupabaseServerClient());

  // Abgleich mit vorhandenen Kunden (RLS: nur eigenes Unternehmen)
  const existing = await client.rpc("import_duplicates", {
    p_tenant: tenant.id,
    p_rows: valid.map(({ data }) => ({
      name: data.name,
      email: data.email ?? "",
    })),
  });
  if (existing.error) return empty(databaseMessage(existing.error));
  const known = new Map<number, string>();
  for (const match of existing.data) {
    const index = valid[match.row_index]?.index;
    if (index !== undefined && !known.has(index)) known.set(index, `wie ${match.number} „${match.name}“`);
  }
  const allDuplicates = [...duplicates, ...[...known].map(([index, reason]) => ({ row: fileRow(index), reason }))].sort(
    (a, b) => a.row - b.row,
  );
  const duplicateRows = new Set(allDuplicates.map((entry) => entry.row));

  const summary = {
    total: rows.length,
    valid: valid.length,
    errors,
    duplicates: allDuplicates,
  };
  if (mode === "check") return { status: "checked", ...summary };

  const toInsert = valid.filter(({ index }) => !(skipDuplicates && duplicateRows.has(fileRow(index))));
  const insertErrors: ImportRowError[] = [];
  let created = 0;
  for (let start = 0; start < toInsert.length; start += CHUNK) {
    const chunk = toInsert.slice(start, start + CHUNK);
    const { error } = await client.from("customers").insert(chunk.map(({ data }) => ({ tenant_id: tenant.id, ...data })));
    if (!error) {
      created += chunk.length;
      continue;
    }
    if (error.code === "42501") return { status: "error", message: FORBIDDEN, ...summary, created };
    // Block abgelehnt: Zeilen einzeln speichern, damit nur die fehlerhaften fehlen
    for (const { index, data } of chunk) {
      const single = await client.from("customers").insert({ tenant_id: tenant.id, ...data });
      if (single.error)
        insertErrors.push({
          row: fileRow(index),
          messages: [databaseMessage(single.error) || GENERIC_ERROR],
        });
      else created += 1;
    }
  }

  refresh();
  return {
    status: "imported",
    ...summary,
    errors: [...errors, ...insertErrors].sort((a, b) => a.row - b.row),
    created,
    skipped: valid.length - toInsert.length,
  };
}
