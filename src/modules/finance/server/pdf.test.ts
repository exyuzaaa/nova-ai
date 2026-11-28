import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DocumentDetail } from "./finance";
import { buildDocumentPdf } from "./pdf";

const base: DocumentDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  kind: "invoice",
  number: "RE-2026-0001",
  status: "issued",
  title: "Wartung",
  recipientName: "Nordlicht GmbH",
  customerId: null,
  issueDate: "2026-11-28",
  dueDate: "2026-12-12",
  grossTotal: 0,
  paidTotal: 0,
  createdAt: "2026-11-28T10:00:00Z",
  projectId: null,
  quoteId: null,
  cancelsId: null,
  introText: "Einleitung mit Umlauten äöüß und Sonderzeichen → „Zitat“",
  closingText: null,
  recipientExtra: null,
  recipientStreet: "Hafenweg 3",
  recipientPostal: "20457",
  recipientCity: "Hamburg",
  recipientCountry: "DE",
  recipientVatId: null,
  serviceDate: "2026-11-01",
  serviceEndDate: "2026-11-30",
  validUntil: null,
  currency: "EUR",
  netTotal: 0,
  taxTotal: 0,
  taxBreakdown: [],
  seller: { legal_name: "Studio Süd GmbH", street: "Marktplatz 1", postal_code: "80331", city: "München", tax_number: "143/123/45678" },
  smallBusiness: false,
  cancelReason: null,
  lines: [],
  payments: [],
  related: [],
};

const line = (index: number) => ({
  id: `line-${index}`,
  position: index,
  title: `Position ${index} mit einem recht langen Titel, der umbrechen muss, damit die Tabelle sauber bleibt`,
  description: index % 3 === 0 ? "Beschreibung\nüber zwei Zeilen" : null,
  quantity: 1.5,
  unit: "Std.",
  unitPrice: 100,
  discountPercent: index % 4 === 0 ? 10 : 0,
  taxRate: 19,
  lineNet: index % 4 === 0 ? 135 : 150,
});

describe("PDF", () => {
  it("bricht viele Positionen auf mehrere Seiten um", async () => {
    const bytes = await buildDocumentPdf({ ...base, lines: Array.from({ length: 60 }, (_, index) => line(index + 1)) }, null);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getTitle()).toContain("RE-2026-0001");
  });

  it("Entwurf und Kleinunternehmer funktionieren ohne Firmendaten", async () => {
    const bytes = await buildDocumentPdf({ ...base, number: null, status: "draft", seller: null, smallBusiness: true, lines: [line(1)] }, null);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
