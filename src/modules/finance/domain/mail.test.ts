import { describe, expect, it } from "vitest";
import { buildMime, defaultMail, encodeHeader, parseAddressList, sendMailSchema } from "./mail";

const decodeWords = (header: string) =>
  header
    .split(/\r\n /)
    .map((word) => Buffer.from(word.replace(/^=\?UTF-8\?B\?|\?=$/g, ""), "base64").toString("utf8"))
    .join("");

describe("Adressen", () => {
  it("liest Listen und lehnt Ungültiges ab", () => {
    expect(parseAddressList(" A@Example.com, b@example.com;a@example.com ")).toEqual(["a@example.com", "b@example.com"]);
    expect(parseAddressList("")).toEqual([]);
    expect(parseAddressList("kein-at")).toBeNull();
    expect(parseAddressList("a@example.com\r\nBcc: x@evil.example")).toBeNull();
    expect(parseAddressList("<a@example.com>")).toBeNull();
  });

  it("prüft das Formular", () => {
    const base = { to: "kunde@example.com", cc: "", subject: "Rechnung", message: "Hallo" };
    expect(sendMailSchema.parse(base)).toEqual({ to: ["kunde@example.com"], cc: [], subject: "Rechnung", message: "Hallo" });
    expect(sendMailSchema.safeParse({ ...base, to: "" }).success).toBe(false);
    expect(sendMailSchema.safeParse({ ...base, cc: "x" }).success).toBe(false);
    expect(sendMailSchema.safeParse({ ...base, to: Array.from({ length: 11 }, (_, i) => `a${i}@example.com`).join(",") }).success).toBe(false);
    expect(sendMailSchema.safeParse({ ...base, subject: " " }).success).toBe(false);
  });
});

describe("MIME", () => {
  it("kodiert Umlaute im Betreff, ohne Zeichen zu zerteilen", () => {
    expect(encodeHeader("Rechnung RE-2026-0001")).toBe("Rechnung RE-2026-0001");
    const subject = "Rechnung RE-2026-0001 – Bäckerei Müller & Söhne GmbH, Großstraße – äöüß ÄÖÜ";
    const encoded = encodeHeader(subject);
    expect(encoded.split("\r\n ").every((line) => line.length <= 76)).toBe(true);
    expect(decodeWords(encoded)).toBe(subject);
  });

  it("baut eine Nachricht mit PDF-Anhang und verhindert Kopfzeilen-Einschleusung", () => {
    const mime = buildMime({
      from: { name: "Studio Süd GmbH", address: "rechnung@studio.example" },
      to: ["kunde@example.com"],
      cc: ["buchhaltung@example.com"],
      subject: "Rechnung\r\nBcc: boese@example.com",
      text: "Zeile 1\nZeile 2 – äöü",
      attachment: { filename: 'RE-2026-0001".pdf', contentType: "application/pdf", content: new TextEncoder().encode("%PDF-1.7 test") },
      boundary: "GRENZE",
      date: new Date("2026-11-28T10:00:00Z"),
    });
    const [head] = mime.split("\r\n\r\n");
    expect(head).toContain("From: =?UTF-8?B?");
    expect(head).toContain("<rechnung@studio.example>");
    expect(head).toContain("To: kunde@example.com");
    expect(head).toContain("Cc: buchhaltung@example.com");
    expect(head).toContain("Subject: Rechnung Bcc: boese@example.com");
    expect(head).not.toMatch(/^Bcc:/m);
    expect(head).toContain("Date: Sat, 28 Nov 2026 10:00:00 +0000");
    expect(head).toContain('Content-Type: multipart/mixed; boundary="GRENZE"');
    expect(mime).toContain('Content-Disposition: attachment; filename="RE-2026-0001_.pdf"');
    expect(mime).toContain(Buffer.from("%PDF-1.7 test").toString("base64"));
    expect(mime).toContain(Buffer.from("Zeile 1\r\nZeile 2 – äöü").toString("base64"));
    expect(mime.trimEnd().endsWith("--GRENZE--")).toBe(true);
    expect(mime.split("\r\n").every((line) => line.length <= 998)).toBe(true);
  });
});

describe("Textvorschlag", () => {
  it("nennt Nummer, Betrag und Fälligkeit", () => {
    const mail = defaultMail({ kind: "invoice", kindLabel: "Rechnung", number: "RE-2026-0001", companyName: "Studio Süd GmbH", recipientName: null, gross: "333,75 €", dueDate: "12.12.2026" });
    expect(mail.subject).toBe("Rechnung RE-2026-0001 – Studio Süd GmbH");
    expect(mail.message).toContain("Rechnung RE-2026-0001 über 333,75 €, zahlbar bis 12.12.2026");
  });
});
