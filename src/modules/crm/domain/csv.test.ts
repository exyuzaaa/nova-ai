import { describe, expect, it } from "vitest";
import { customerSchema } from "./crm";
import { detectDelimiter, escapeCsvCell, guessMapping, parseCsv, rowToCustomerInput, toCsv } from "./csv";

describe("CSV-Export", () => {
  it("schreibt Excel-kompatibel mit BOM, Semikolon und Anführungszeichen", () => {
    const csv = toCsv(
      ["Name", "Notiz"],
      [
        ["Müller; Söhne", 'Sagt "Hallo"\nZweite Zeile'],
        ["Schmidt", null],
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿Name;Notiz\r\n"Müller; Söhne";"Sagt ""Hallo""\nZweite Zeile"\r\nSchmidt;\r\n');
  });

  it("entschärft Formeln", () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(escapeCsvCell("+49 30 123")).toBe("'+49 30 123");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell(-5)).toBe("-5");
  });
});

describe("CSV-Import", () => {
  it("erkennt das Trennzeichen", () => {
    expect(detectDelimiter("Name;Ort\nA;B")).toBe(";");
    expect(detectDelimiter("Name,Ort\nA,B")).toBe(",");
    expect(detectDelimiter('"Name;mit;Semikolon",Ort,PLZ')).toBe(",");
  });

  it("liest Anführungszeichen, Zeilenumbrüche und leere Zeilen", () => {
    const { header, rows } = parseCsv('﻿Name;Notiz\r\n"Müller; Söhne";"Zeile 1\nZeile 2"\r\n\r\nSchmidt;"Sagt ""Hi"""\r\n');
    expect(header).toEqual(["Name", "Notiz"]);
    expect(rows).toEqual([
      ["Müller; Söhne", "Zeile 1\nZeile 2"],
      ["Schmidt", 'Sagt "Hi"'],
    ]);
  });

  it("begrenzt die Zeilenzahl", () => {
    const text = ["Name", ...Array.from({ length: 20 }, (_, index) => `Kunde ${index}`)].join("\n");
    const result = parseCsv(text, 10);
    expect(result.rows).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("ordnet deutsche Spaltennamen zu und normalisiert Werte", () => {
    const { header, rows } = parseCsv(
      "Firma;E-Mail;PLZ;Ort;Land;Status;Schlagwörter;Art\nMüller GmbH;INFO@mueller.de;80331;München;Deutschland;Interessent;B2B|Bayern;Firma",
    );
    const mapping = guessMapping(header);
    expect(mapping.name).toBe(0);
    expect(mapping.phone).toBe(-1);
    const input = rowToCustomerInput(rows[0], mapping);
    const parsed = customerSchema.parse(input);
    expect(parsed).toMatchObject({
      name: "Müller GmbH",
      email: "info@mueller.de",
      country_code: "DE",
      status: "prospect",
      tags: ["B2B", "Bayern"],
      kind: "company",
    });
  });

  it("macht die Export-Entschärfung beim Import rückgängig", () => {
    const mapping = guessMapping(["Name", "Telefon"]);
    expect(rowToCustomerInput(["'=Summe", "'+49 30 123"], mapping)).toMatchObject({ name: "=Summe", phone: "+49 30 123" });
    expect(rowToCustomerInput(["O'Brien", "'x"], mapping)).toMatchObject({ name: "O'Brien", phone: "'x" });
  });

  it("meldet ungültige Zeilen über die Formularprüfung", () => {
    const mapping = guessMapping(["Name", "E-Mail", "Land"]);
    expect(customerSchema.safeParse(rowToCustomerInput(["", "a@b.de", "DE"], mapping)).success).toBe(false);
    expect(customerSchema.safeParse(rowToCustomerInput(["X", "kaputt", "DE"], mapping)).success).toBe(false);
    expect(customerSchema.safeParse(rowToCustomerInput(["X", "", "Atlantis"], mapping)).success).toBe(false);
  });
});
