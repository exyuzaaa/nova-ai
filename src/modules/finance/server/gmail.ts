import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/* Anbindung an Gmail (Google OAuth 2.0, nur Recht „E-Mails senden“).
   Benötigt GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET (nur serverseitig, Vercel).
   Das Refresh-Token wird mit einem aus dem Client-Secret abgeleiteten Schlüssel
   (AES-256-GCM) verschlüsselt gespeichert: Ohne Server-Geheimnis ist es wertlos. */

export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send"];
export const GMAIL_CALLBACK_PATH = "/api/google/callback";

type Endpoints = { auth: string; token: string; revoke: string; send: string };

const REAL: Endpoints = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
  send: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
};

/** Nur für automatische Tests: Google-Attrappe statt echter Google-Server (auf Vercel wirkungslos). */
const endpoints = (env: NodeJS.ProcessEnv = process.env): Endpoints => {
  const base = env.NOVA_TEST_GOOGLE_BASE_URL;
  if (!base || env.VERCEL || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) return REAL;
  return { auth: `${base}/auth`, token: `${base}/token`, revoke: `${base}/revoke`, send: `${base}/gmail/v1/users/me/messages/send` };
};

const config = (env: NodeJS.ProcessEnv = process.env) => {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

/** Ist der Google-Zugang der Plattform hinterlegt? */
export const isGmailConfigured = (env: NodeJS.ProcessEnv = process.env) => config(env) !== null;

export type GmailErrorCode = "config" | "scope" | "revoked" | "denied" | "limit" | "failed";

export class GmailError extends Error {
  constructor(
    message: string,
    readonly code: GmailErrorCode = "failed",
  ) {
    super(message);
  }
  /** Die Verbindung muss neu hergestellt werden. */
  get reconnect() {
    return this.code === "revoked" || this.code === "denied";
  }
}

const requireConfig = () => {
  const value = config();
  if (!value) throw new GmailError("Der Gmail-Versand ist auf dieser NOVA-Installation noch nicht eingerichtet.", "config");
  return value;
};

// -----------------------------------------------------------------------------
// Verschlüsselung des Refresh-Tokens
// -----------------------------------------------------------------------------
const key = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "nova-finance-mail", "refresh-token-v1", 32));

export const encryptToken = (token: string, secret = requireConfig().clientSecret) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url")}`;
};

export const decryptToken = (value: string, secret = requireConfig().clientSecret) => {
  if (!value.startsWith("v1.")) throw new GmailError("Die Gmail-Verbindung ist ungültig. Bitte neu verbinden.", "revoked");
  const raw = Buffer.from(value.slice(3), "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    // z. B. nach einem Wechsel des Client-Secrets
    throw new GmailError("Die Gmail-Verbindung ist nicht mehr gültig. Bitte neu verbinden.", "revoked");
  }
};

// -----------------------------------------------------------------------------
// OAuth
// -----------------------------------------------------------------------------
export const authorizationUrl = (state: string, redirectUri: string, loginHint?: string) => {
  const { clientId } = requireConfig();
  const url = new URL(endpoints().auth);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // sonst liefert Google bei erneuter Verbindung kein Refresh-Token
    include_granted_scopes: "true",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
};

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; scope?: string; error?: string; error_description?: string };

const tokenRequest = async (body: Record<string, string>): Promise<TokenResponse> => {
  const response = await fetch(endpoints().token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || data.error) {
    if (data.error === "invalid_grant") throw new GmailError("Google hat den Zugriff widerrufen oder er ist abgelaufen. Bitte Gmail neu verbinden.", "revoked");
    throw new GmailError(`Google hat die Anmeldung abgelehnt (${data.error ?? response.status}).`);
  }
  return data;
};

/** E-Mail-Adresse aus dem ID-Token (direkt vom Token-Endpunkt über TLS empfangen, OIDC Core 3.1.3.7). */
const emailFromIdToken = (idToken: string | undefined) => {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; email_verified?: boolean };
    return claims.email && claims.email_verified !== false ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
};

/** Code aus der Rückleitung gegen Tokens tauschen. */
export const exchangeCode = async (code: string, redirectUri: string) => {
  const { clientId, clientSecret } = requireConfig();
  const data = await tokenRequest({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!data.scope?.split(" ").includes("https://www.googleapis.com/auth/gmail.send")) {
    throw new GmailError("Bitte erlaube NOVA, E-Mails in deinem Namen zu senden (Häkchen bei Google setzen).", "scope");
  }
  const email = emailFromIdToken(data.id_token);
  if (!data.refresh_token || !email) throw new GmailError("Google hat keine dauerhafte Freigabe geliefert. Bitte erneut verbinden.");
  return { email, refreshToken: data.refresh_token };
};

const accessToken = async (refreshToken: string) => {
  const { clientId, clientSecret } = requireConfig();
  const data = await tokenRequest({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
  if (!data.access_token) throw new GmailError("Google hat keinen Zugang ausgestellt.");
  return data.access_token;
};

/** Freigabe bei Google widerrufen (beim Trennen; Fehler werden ignoriert). */
export const revokeToken = async (encrypted: string) => {
  try {
    const token = decryptToken(encrypted);
    await fetch(endpoints().revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Die Verbindung ist in NOVA bereits entfernt; Google entfernt ungenutzte Freigaben selbst.
  }
};

/** Fertige MIME-Nachricht (base64url) über das verbundene Postfach senden. */
export const sendRawMessage = async (encryptedRefreshToken: string, raw: string): Promise<string | null> => {
  const token = await accessToken(decryptToken(encryptedRefreshToken));
  const response = await fetch(endpoints().send, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string; status?: string } };
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GmailError("Gmail hat den Versand abgelehnt (keine Berechtigung). Bitte Gmail neu verbinden.", "denied");
    }
    if (response.status === 429) throw new GmailError("Gmail-Versandlimit erreicht. Bitte später erneut versuchen.", "limit");
    throw new GmailError(`Gmail hat den Versand abgelehnt (${data.error?.status ?? response.status}).`);
  }
  return data.id ?? null;
};
