import { describe, expect, it } from "vitest";
import { stageSchema } from "./crm";
import { guessMapping, rowToCustomerInput } from "./csv";
import { evaluateImportRows } from "./customer-import";

const mapping = guessMapping(["Name", "E-Mail", "Land"]);
const rows = (values: string[][]) => values.map((row) => rowToCustomerInput(row, mapping));

describe("Kundenimport prüfen", () => {
  it("trennt gültige und fehlerhafte Zeilen und nennt die Zeile in der Datei", () => {
    const result = evaluateImportRows(rows([["Müller GmbH", "info@mueller.de", "DE"], ["", "x@y.de", "DE"], ["Schmidt", "kaputt", "Atlantis"]]));
    expect(result.valid.map((entry) => entry.data.name)).toEqual(["Müller GmbH"]);
    expect(result.errors).toEqual([
      { row: 3, messages: ["Name: Bitte gib einen Namen ein."] },
      { row: 4, messages: [expect.stringMatching(/^E-Mail-Adresse: /), "Land: Bitte wähle ein Land."] },
    ]);
  });

  it("erkennt Dubletten innerhalb der Datei über Name oder E-Mail", () => {
    const result = evaluateImportRows(
      rows([["Müller GmbH", "info@mueller.de", "DE"], ["MÜLLER GMBH", "", "DE"], ["Andere AG", "INFO@mueller.de", "DE"], ["Neu", "", "DE"]]),
    );
    expect(result.valid).toHaveLength(4);
    expect(result.duplicates).toEqual([
      { row: 3, reason: "wie Zeile 2 in dieser Datei" },
      { row: 4, reason: "wie Zeile 2 in dieser Datei" },
    ]);
  });
});

describe("Phasen", () => {
  it("prüft Name und Wahrscheinlichkeit", () => {
    expect(stageSchema.parse({ name: " Angebot ", probability: "40" })).toEqual({ name: "Angebot", probability: 40 });
    expect(stageSchema.safeParse({ name: "X", probability: "101" }).success).toBe(false);
    expect(stageSchema.safeParse({ name: "X", probability: "12,5" }).success).toBe(false);
    expect(stageSchema.safeParse({ name: "", probability: "10" }).success).toBe(false);
  });
});
