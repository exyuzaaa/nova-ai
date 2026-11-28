import { z } from "zod";

/* Belegversand per E-Mail: Eingaben prüfen und die Nachricht (MIME, RFC 5322) bauen.
   Ohne Bibliothek, damit nichts Unerwartetes in die Kopfzeilen gelangt. */

const EMAIL = /^[^@\s<>(),;:"\\[\]]+@[^@\s<>(),;:"\\[\]]+\.[^@\s<>(),;:"\\[\]]+$/;

/** Kommagetrennte Adressen („a@b.de, c@d.de“) → Liste; ungültige führen zum Fehler. */
export const parseAddressList = (value: string): string[] | null => {
  const list = value
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (list.some((entry) => !EMAIL.test(entry) || entry.length > 320)) return null;
  return [...new Set(list)];
};

const addresses = (label: string, min: number) =>
  z
    .string()
    .transform((value, ctx) => {
      const list = parseAddressList(value);
      if (!list) {
        ctx.addIssue({ code: "custom", message: `${label}: bitte gültige E-Mail-Adressen eingeben, getrennt durch Komma.` });
        return z.NEVER;
      }
      return list;
    })
    .pipe(
      z
        .array(z.string())
        .min(min, { error: `Bitte mindestens eine Adresse bei „${label}“ angeben.` })
        .max(10, { error: `${label}: höchstens 10 Adressen.` }),
    );

export const sendMailSchema = z.object({
  to: addresses("An", 1),
  cc: addresses("Kopie (CC)", 0),
  subject: z.string().trim().min(1, { error: "Bitte gib einen Betreff ein." }).max(300, { error: "Der Betreff ist zu lang." }),
  message: z.string().trim().min(1, { error: "Bitte gib eine Nachricht ein." }).max(10_000, { error: "Die Nachricht ist zu lang." }),
});

/** Vorschlag für Betreff und Text. */
export const defaultMail = (doc: { kindLabel: string; number: string; companyName: string; recipientName: string | null; gross: string; dueDate: string | null; kind: string }) => {
  const greeting = "Sehr geehrte Damen und Herren,";
  const body =
    doc.kind === "quote"
      ? `anbei erhalten Sie unser Angebot ${doc.number} über ${doc.gross}.\n\nWir freuen uns auf Ihre Rückmeldung.`
      : doc.kind === "credit_note"
        ? `anbei erhalten Sie die Gutschrift ${doc.number} über ${doc.gross}.`
        : `anbei erhalten Sie unsere Rechnung ${doc.number} über ${doc.gross}${doc.dueDate ? `, zahlbar bis ${doc.dueDate}` : ""}.\n\nVielen Dank für Ihren Auftrag.`;
  return {
    subject: `${doc.kindLabel} ${doc.number} – ${doc.companyName}`,
    message: `${greeting}\n\n${body}\n\nMit freundlichen Grüßen\n${doc.companyName}`,
  };
};

// -----------------------------------------------------------------------------
// MIME
// -----------------------------------------------------------------------------
const noBreaks = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

/** Kopfzeilen-Wort nach RFC 2047 (nur wenn nötig). */
export const encodeHeader = (value: string) => {
  const clean = noBreaks(value);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  // Höchstens 45 Byte je Wort, damit jede Zeile unter 76 Zeichen bleibt; Zeichen nicht zerteilen
  const words: string[] = [];
  let chunk = "";
  for (const char of clean) {
    if (Buffer.byteLength(chunk + char) > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);
  return words.map((word) => `=?UTF-8?B?${Buffer.from(word).toString("base64")}?=`).join("\r\n ");
};

const mailbox = (name: string | null, address: string) => {
  const cleanAddress = noBreaks(address).replace(/[<>]/g, "");
  if (!name) return cleanAddress;
  const display = noBreaks(name);
  const encoded = /^[\x20-\x7E]*$/.test(display) ? `"${display.replace(/["\\]/g, "")}"` : encodeHeader(display);
  return `${encoded} <${cleanAddress}>`;
};

const base64Lines = (data: Uint8Array | string) => (Buffer.from(data).toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

export type MailInput = {
  from: { name: string | null; address: string };
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  attachment?: { filename: string; contentType: string; content: Uint8Array };
  date?: Date;
  boundary?: string;
  messageIdDomain?: string;
};

/** Vollständige Nachricht als Text (CRLF). */
export const buildMime = (input: MailInput): string => {
  const boundary = input.boundary ?? `nova-${crypto.randomUUID()}`;
  const date = (input.date ?? new Date()).toUTCString().replace("GMT", "+0000");
  const domain = input.messageIdDomain ?? (input.from.address.split("@")[1] || "nova.local");
  const headers = [
    `From: ${mailbox(input.from.name, input.from.address)}`,
    `To: ${input.to.map((address) => mailbox(null, address)).join(", ")}`,
    ...(input.cc.length > 0 ? [`Cc: ${input.cc.map((address) => mailbox(null, address)).join(", ")}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${date}`,
    `Message-ID: <${crypto.randomUUID()}@${noBreaks(domain)}>`,
    "MIME-Version: 1.0",
  ];
  const textPart = ["Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(input.text.replace(/\r?\n/g, "\r\n"))];
  if (!input.attachment) return [...headers, ...textPart, ""].join("\r\n");
  const filename = noBreaks(input.attachment.filename).replace(/["\\/]/g, "_");
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...textPart,
    `--${boundary}`,
    `Content-Type: ${input.attachment.contentType}; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.attachment.content),
    `--${boundary}--`,
    "",
  ].join("\r\n");
};

/** Für die Gmail-API: Nachricht als base64url. */
export const toBase64Url = (value: string) => Buffer.from(value).toString("base64url");
