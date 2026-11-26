/**
 * Liest E-Mails aus dem lokalen Mailpit (Supabase-Entwicklungsumgebung) und
 * extrahiert Bestätigungs- bzw. Passwort-Links.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string; Subject: string }[] };
type MailpitMessage = { HTML: string; Text: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Wartet auf die neueste E-Mail an `to` (optional mit Betreff) und gibt den App-Link zurück. */
export const waitForAuthLink = async (to: string, subjectIncludes?: string, timeoutMs = 15_000): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (response.ok) {
      const result = (await response.json()) as MailpitSearch;
      const message = result.messages.find((item) => !subjectIncludes || item.Subject.includes(subjectIncludes));
      if (message) {
        const detail = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)).json()) as MailpitMessage;
        const match = detail.HTML.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/);
        if (match) return match[1].replace(/&amp;/g, "&");
      }
    }
    await sleep(300);
  }
  throw new Error(`Keine E-Mail an ${to}${subjectIncludes ? ` mit Betreff „${subjectIncludes}“` : ""} erhalten`);
};
