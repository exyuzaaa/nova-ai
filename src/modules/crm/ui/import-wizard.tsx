"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/app/native-select";
import { FormMessage } from "@/modules/auth/ui/form-field";
import { CUSTOMER_IMPORT_FIELDS, guessMapping, parseCsv, rowToCustomerInput, toCsv, type CustomerImportField } from "../domain/csv";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "../domain/customer-import";
import { importCustomersAction, type ImportResult } from "../server/actions/import-actions";

type Parsed = { fileName: string; header: string[]; rows: string[][] };

/** Excel speichert CSV oft in Windows-1252 statt UTF-8 – beides wird erkannt. */
const decode = (buffer: ArrayBuffer): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
};

const SHOWN = 50;

/** Kundenimport in drei Schritten: Datei wählen → Spalten zuordnen und prüfen → importieren. */
export function CustomerImportWizard({ tenantId, customersHref }: { tenantId: string; customersHref: string }) {
  const fileId = useId();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<CustomerImportField, number> | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isPending, startTransition] = useTransition();

  const mappedRows = useMemo(
    () => (parsed && mapping ? parsed.rows.map((row) => rowToCustomerInput(row, mapping)) : []),
    [parsed, mapping],
  );

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setParsed(null);
    setMapping(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError("Die Datei ist größer als 2 MB. Bitte teile sie auf.");
      return;
    }
    const { header, rows, truncated } = parseCsv(decode(await file.arrayBuffer()), MAX_IMPORT_ROWS);
    if (truncated) {
      setFileError(`Die Datei hat mehr als ${MAX_IMPORT_ROWS} Zeilen. Bitte teile sie auf.`);
      return;
    }
    if (header.length === 0 || rows.length === 0) {
      setFileError("Die Datei enthält keine Daten. Die erste Zeile muss die Spaltennamen enthalten.");
      return;
    }
    setParsed({ fileName: file.name, header, rows });
    setMapping(guessMapping(header));
  };

  // Datei schon gewählt, bevor die Seite interaktiv war (langsame Verbindung)? Dann jetzt einlesen.
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef(true);
  useEffect(() => {
    if (!pendingFile.current) return;
    pendingFile.current = false;
    const file = inputRef.current?.files?.[0];
    if (file) void onFile(file);
  });

  const run = (mode: "check" | "import") => {
    if (!parsed || !mapping) return;
    startTransition(async () => {
      setResult(
        await importCustomersAction({
          tenantId,
          mode,
          skipDuplicates,
          rows: mappedRows,
        }),
      );
    });
  };

  const downloadReport = () => {
    if (!result) return;
    const lines = [
      ...result.errors.map((entry) => [entry.row, "Fehler", entry.messages.join(" · ")]),
      ...result.duplicates.map((entry) => [entry.row, "Mögliche Dublette", entry.reason]),
    ].sort((a, b) => Number(a[0]) - Number(b[0]));
    const blob = new Blob([toCsv(["Zeile", "Art", "Hinweis"], lines)], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "importbericht.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const imported = result?.status === "imported";
  const importable = result ? result.valid - (skipDuplicates ? new Set(result.duplicates.map((entry) => entry.row)).size : 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Schritt 1 */}
      <section aria-labelledby={`${fileId}-step1`} className="flex flex-col gap-3">
        <h2 id={`${fileId}-step1`} className="text-sm font-medium">
          1. CSV-Datei wählen
        </h2>
        <p className="text-sm text-muted-foreground">
          Erste Zeile mit Spaltennamen, Trennzeichen Semikolon oder Komma, höchstens {MAX_IMPORT_ROWS} Kunden und 2 MB. Eine Datei aus dem
          Kundenexport lässt sich direkt wieder einlesen.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fileId}>CSV-Datei</Label>
          <input
            id={fileId}
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={isPending}
            onChange={(event) => onFile(event.currentTarget.files?.[0])}
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
        {fileError && <FormMessage status="error" message={fileError} />}
      </section>

      {parsed && mapping && !imported && (
        <section aria-labelledby={`${fileId}-step2`} className="flex flex-col gap-3">
          <h2 id={`${fileId}-step2`} className="text-sm font-medium">
            2. Spalten zuordnen
          </h2>
          <p className="text-sm text-muted-foreground">
            {parsed.fileName}: {parsed.rows.length} {parsed.rows.length === 1 ? "Zeile" : "Zeilen"}. Erkannte Spalten sind schon ausgewählt.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CUSTOMER_IMPORT_FIELDS.map((field) => (
              <NativeSelect
                key={field.key}
                label={field.key === "name" ? `${field.label} (Pflicht)` : field.label}
                value={String(mapping[field.key])}
                onChange={(event) => {
                  setResult(null);
                  setMapping({
                    ...mapping,
                    [field.key]: Number(event.currentTarget.value),
                  });
                }}
              >
                <option value="-1">– nicht importieren –</option>
                {parsed.header.map((column, index) => (
                  <option key={`${column}-${index}`} value={index}>
                    {column || `Spalte ${index + 1}`}
                  </option>
                ))}
              </NativeSelect>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Vorschau der ersten Zeilen</caption>
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">E-Mail</th>
                  <th className="px-3 py-2 font-medium">Ort</th>
                  <th className="px-3 py-2 font-medium">Land</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.slice(0, 5).map((row, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{row.name || <span className="text-negative">fehlt</span>}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{[row.postal_code, row.city].filter(Boolean).join(" ")}</td>
                    <td className="px-3 py-2">{row.country_code}</td>
                    <td className="px-3 py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Button type="button" onClick={() => run("check")} disabled={isPending || mapping.name < 0}>
              {isPending && !result ? "Wird geprüft …" : "Daten prüfen"}
            </Button>
            {mapping.name < 0 && <p className="mt-1 text-xs text-negative">Bitte ordne die Spalte für den Namen zu.</p>}
          </div>
        </section>
      )}

      {result && (
        <section aria-labelledby={`${fileId}-step3`} className="flex flex-col gap-3" aria-live="polite">
          <h2 id={`${fileId}-step3`} className="text-sm font-medium">
            {imported ? "Ergebnis" : "3. Prüfergebnis und Import"}
          </h2>
          {result.status === "error" && <FormMessage status="error" message={result.message} />}
          {imported && (
            <FormMessage
              status="success"
              message={`${result.created ?? 0} ${result.created === 1 ? "Kunde" : "Kunden"} importiert${
                result.skipped ? `, ${result.skipped} Dubletten übersprungen` : ""
              }${result.errors.length ? `, ${result.errors.length} Zeilen mit Fehlern nicht importiert` : ""}.`}
            />
          )}
          {result.status !== "error" && (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Zeilen", result.total],
                ["Gültig", result.valid],
                ["Mit Fehlern", result.errors.length],
                ["Mögliche Dubletten", result.duplicates.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {(result.errors.length > 0 || result.duplicates.length > 0) && (
            <details className="rounded-lg border p-3" open={!imported}>
              <summary className="cursor-pointer text-sm font-medium">Hinweise zu einzelnen Zeilen</summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {result.errors.slice(0, SHOWN).map((entry) => (
                  <li key={`e${entry.row}`}>
                    <span className="font-medium text-negative">Zeile {entry.row}:</span> {entry.messages.join(" · ")}
                  </li>
                ))}
                {result.duplicates.slice(0, SHOWN).map((entry) => (
                  <li key={`d${entry.row}`}>
                    <span className="font-medium">Zeile {entry.row}:</span> mögliche Dublette ({entry.reason})
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={downloadReport}>
                <Download className="size-4" aria-hidden />
                Bericht als CSV herunterladen
              </Button>
            </details>
          )}

          {result.status === "checked" && (
            <div className="flex flex-col gap-3">
              {result.duplicates.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={skipDuplicates} onChange={(event) => setSkipDuplicates(event.currentTarget.checked)} />
                  Mögliche Dubletten überspringen
                </label>
              )}
              <div>
                <Button type="button" onClick={() => run("import")} disabled={isPending || importable <= 0}>
                  <Upload className="size-4" aria-hidden />
                  {isPending ? "Wird importiert …" : `${importable} ${importable === 1 ? "Kunde" : "Kunden"} importieren`}
                </Button>
              </div>
            </div>
          )}

          {imported && (
            <p className="text-sm">
              <Link href={customersHref} className="font-medium text-brand hover:underline">
                Zur Kundenliste
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
