import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatEuro, formatQuantity, KIND_LABELS } from "../domain/finance";
import type { DocumentDetail } from "./finance";

/* PDF (DIN A4) für Angebote, Rechnungen und Gutschriften – ohne externe Dienste.
   Inhalt nach § 14 UStG: vollständiger Name und Anschrift von Absender und Empfänger,
   Steuernummer/USt-IdNr., Ausstellungsdatum, fortlaufende Nummer, Menge und Art der
   Leistung, Leistungszeitpunkt, Entgelt nach Steuersätzen, Steuerbetrag bzw. Hinweis
   auf die Steuerbefreiung. */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const GRAY = rgb(0.4, 0.4, 0.45);
const LINE = rgb(0.85, 0.85, 0.88);

/** Standardschriften kennen nur WinAnsi: nicht darstellbare Zeichen ersetzen. */
const winAnsi = (text: string) =>
  text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[→⇒]/g, "->")
    .replace(/[←⇐]/g, "<-")
    .replace(/[•·]/g, "\xB7")
    .replace(/ | /g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF€\n]/g, "?");

const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");
const money = (value: number, currency: string) => winAnsi(formatEuro(value, currency));

const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of winAnsi(text).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
        while (font.widthOfTextAtSize(current, size) > width && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > width) cut -= 1;
          lines.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      }
    }
    lines.push(current);
  }
  return lines;
};

export const buildDocumentPdf = async (doc: DocumentDetail, fallbackSeller: Record<string, unknown> | null): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const seller = (doc.seller ?? fallbackSeller ?? {}) as Record<string, string | number | boolean | null>;
  const s = (key: string) => (seller[key] === null || seller[key] === undefined ? "" : String(seller[key]));
  const kindLabel = doc.kind === "credit_note" && doc.cancelsId ? "Stornorechnung" : KIND_LABELS[doc.kind];
  const title = `${kindLabel} ${doc.number ?? "(Entwurf)"}`;
  pdf.setTitle(winAnsi(title));
  pdf.setAuthor(winAnsi(s("legal_name") || "NOVA"));
  pdf.setCreator("NOVA");

  const pages: PDFPage[] = [];
  let page = pdf.addPage([A4.width, A4.height]);
  pages.push(page);
  let y = A4.height - MARGIN;

  const text = (value: string, x: number, at: number, size = 9, font = regular, color = rgb(0, 0, 0)) =>
    page.drawText(winAnsi(value), { x, y: at, size, font, color });
  const right = (value: string, xRight: number, at: number, size = 9, font = regular) =>
    page.drawText(winAnsi(value), { x: xRight - font.widthOfTextAtSize(winAnsi(value), size), y: at, size, font });

  // Absenderzeile und Logo-Ersatz
  text(s("legal_name") || "Unternehmen", MARGIN, y, 14, bold);
  y -= 40;
  text([s("legal_name"), s("street"), [s("postal_code"), s("city")].filter(Boolean).join(" ")].filter(Boolean).join(" · "), MARGIN, y, 7, regular, GRAY);
  y -= 14;

  // Empfänger
  const recipient = [
    doc.recipientName,
    doc.recipientExtra,
    doc.recipientStreet,
    [doc.recipientPostal, doc.recipientCity].filter(Boolean).join(" "),
    doc.recipientCountry !== "DE" ? doc.recipientCountry : null,
  ].filter((line): line is string => Boolean(line));
  let ry = y;
  for (const line of recipient) {
    text(line, MARGIN, ry, 10);
    ry -= 13;
  }

  // Belegdaten rechts
  const info: [string, string][] = [
    [`${kindLabel}snummer`.replace("Stornorechnungsnummer", "Stornonummer"), doc.number ?? "Entwurf"],
    ["Datum", fmtDate(doc.issueDate) || "–"],
  ];
  if (doc.kind !== "quote" && doc.serviceDate)
    info.push(["Leistungsdatum", doc.serviceEndDate ? `${fmtDate(doc.serviceDate)} – ${fmtDate(doc.serviceEndDate)}` : fmtDate(doc.serviceDate)]);
  if (doc.kind === "invoice" && doc.dueDate) info.push(["Zahlbar bis", fmtDate(doc.dueDate)]);
  if (doc.kind === "quote" && doc.validUntil) info.push(["Gültig bis", fmtDate(doc.validUntil)]);
  if (doc.recipientVatId) info.push(["USt-IdNr. Kunde", doc.recipientVatId]);
  let iy = y;
  for (const [label, value] of info) {
    text(label, 360, iy, 8, regular, GRAY);
    right(value, A4.width - MARGIN, iy, 9);
    iy -= 13;
  }
  y = Math.min(ry, iy) - 30;

  if (doc.status === "draft") {
    page.drawText("ENTWURF", { x: 150, y: 400, size: 90, font: bold, color: rgb(0.9, 0.9, 0.92), opacity: 0.6 });
  }

  text(title, MARGIN, y, 14, bold);
  y -= 16;
  if (doc.title) {
    text(doc.title, MARGIN, y, 10);
    y -= 14;
  }
  y -= 6;
  for (const line of wrap(doc.introText ?? (doc.kind === "quote" ? "Gerne bieten wir Ihnen an:" : "Wir berechnen Ihnen folgende Leistungen:"), regular, 9.5, A4.width - 2 * MARGIN)) {
    text(line, MARGIN, y, 9.5);
    y -= 13;
  }
  y -= 8;

  // Positionstabelle
  const columns = { pos: MARGIN, title: MARGIN + 26, qty: 330, price: 420, tax: 465, total: A4.width - MARGIN };
  const header = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: A4.width - 2 * MARGIN, height: 16, color: rgb(0.95, 0.95, 0.97) });
    text("Pos.", columns.pos + 2, y, 8, bold);
    text("Bezeichnung", columns.title, y, 8, bold);
    right("Menge", columns.qty + 40, y, 8, bold);
    right("Einzelpreis", columns.price, y, 8, bold);
    right("USt", columns.tax, y, 8, bold);
    right("Gesamt (netto)", columns.total, y, 8, bold);
    y -= 18;
  };
  const newPage = () => {
    page = pdf.addPage([A4.width, A4.height]);
    pages.push(page);
    y = A4.height - MARGIN;
    text(title, MARGIN, y, 9, bold);
    y -= 22;
  };
  header();
  doc.lines.forEach((line, index) => {
    const titleLines = wrap(line.title, bold, 9, columns.qty - columns.title - 50);
    const descLines = line.description ? wrap(line.description, regular, 8, columns.qty - columns.title - 50) : [];
    const height = titleLines.length * 12 + descLines.length * 10 + (line.discountPercent ? 10 : 0) + 8;
    if (y - height < 150) {
      newPage();
      header();
    }
    text(String(index + 1), columns.pos + 2, y, 9);
    right(`${formatQuantity(line.quantity)} ${line.unit}`, columns.qty + 40, y, 9);
    right(money(line.unitPrice, doc.currency), columns.price, y, 9);
    right(`${formatQuantity(line.taxRate)} %`, columns.tax, y, 9);
    right(money(line.lineNet, doc.currency), columns.total, y, 9);
    let ly = y;
    for (const part of titleLines) {
      text(part, columns.title, ly, 9, bold);
      ly -= 12;
    }
    for (const part of descLines) {
      text(part, columns.title, ly, 8, regular, GRAY);
      ly -= 10;
    }
    if (line.discountPercent) {
      text(`abzgl. ${formatQuantity(line.discountPercent)} % Rabatt`, columns.title, ly, 8, regular, GRAY);
      ly -= 10;
    }
    // Trennlinie unter der Zeile (unterhalb der Unterlängen), danach Abstand zur nächsten Grundlinie
    const separator = ly + 5;
    page.drawLine({ start: { x: MARGIN, y: separator }, end: { x: A4.width - MARGIN, y: separator }, thickness: 0.5, color: LINE });
    y = separator - 13;
  });

  // Summen
  if (y < 220) newPage();
  y -= 8;
  const sum = (label: string, value: string, strong = false) => {
    text(label, 360, y, 9.5, strong ? bold : regular);
    right(value, A4.width - MARGIN, y, 9.5, strong ? bold : regular);
    y -= 14;
  };
  sum("Summe netto", money(doc.netTotal, doc.currency));
  if (!doc.smallBusiness) {
    for (const row of doc.taxBreakdown) sum(`USt ${formatQuantity(row.rate)} % auf ${money(row.net, doc.currency)}`, money(row.tax, doc.currency));
  }
  page.drawLine({ start: { x: 360, y: y + 10 }, end: { x: A4.width - MARGIN, y: y + 10 }, thickness: 0.8 });
  sum(doc.kind === "quote" ? "Angebotssumme" : "Gesamtbetrag", money(doc.grossTotal, doc.currency), true);
  if (doc.kind === "invoice" && doc.paidTotal > 0) {
    sum("Bereits bezahlt", money(-doc.paidTotal, doc.currency));
    sum("Offener Betrag", money(doc.grossTotal - doc.paidTotal, doc.currency), true);
  }
  y -= 10;

  const notes: string[] = [];
  if (doc.smallBusiness) notes.push("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.");
  if (doc.kind === "credit_note" && doc.cancelReason) notes.push(`Grund: ${doc.cancelReason}`);
  if (doc.kind === "invoice" && doc.dueDate) {
    notes.push(
      `Bitte überweisen Sie den Betrag bis zum ${fmtDate(doc.dueDate)}${s("iban") ? ` auf das Konto IBAN ${s("iban").replace(/(.{4})/g, "$1 ").trim()}${s("bic") ? `, BIC ${s("bic")}` : ""}` : ""} unter Angabe der Rechnungsnummer ${doc.number ?? ""}.`,
    );
  }
  if (doc.closingText) notes.push(doc.closingText);
  for (const note of notes) {
    for (const line of wrap(note, regular, 9, A4.width - 2 * MARGIN)) {
      if (y < 110) newPage();
      text(line, MARGIN, y, 9);
      y -= 12;
    }
    y -= 4;
  }

  // Fußzeile auf jeder Seite
  const footer = [
    [s("legal_name"), s("street"), [s("postal_code"), s("city")].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    [s("phone") && `Tel. ${s("phone")}`, s("email"), s("website")].filter(Boolean).join(" · "),
    [s("tax_number") && `Steuernr. ${s("tax_number")}`, s("vat_id") && `USt-IdNr. ${s("vat_id")}`, s("register_info"), s("managing_directors") && `Geschäftsführung: ${s("managing_directors")}`]
      .filter(Boolean)
      .join(" · "),
    [s("bank_name"), s("iban") && `IBAN ${s("iban")}`, s("bic") && `BIC ${s("bic")}`].filter(Boolean).join(" · "),
    s("invoice_footer"),
  ].filter(Boolean);
  pages.forEach((current, index) => {
    let fy = 30 + footer.length * 9;
    current.drawLine({ start: { x: MARGIN, y: fy + 8 }, end: { x: A4.width - MARGIN, y: fy + 8 }, thickness: 0.5, color: LINE });
    for (const line of footer) {
      for (const part of wrap(line, regular, 6.5, A4.width - 2 * MARGIN - 50)) {
        current.drawText(part, { x: MARGIN, y: fy, size: 6.5, font: regular, color: GRAY });
        fy -= 9;
      }
    }
    const label = `Seite ${index + 1} von ${pages.length}`;
    current.drawText(label, { x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 7), y: 30, size: 7, font: regular, color: GRAY });
  });

  return pdf.save();
};
