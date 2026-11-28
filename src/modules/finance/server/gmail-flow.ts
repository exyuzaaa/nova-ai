import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getAppOrigin } from "@/lib/app-origin";
import { GMAIL_CALLBACK_PATH } from "./gmail";

/* Ablauf „Mit Gmail verbinden“: Zustand (Schutz gegen untergeschobene Rückleitungen)
   liegt in einem kurzlebigen, httpOnly-Cookie, das nur die Rückleitungs-Route liest. */

export const OAUTH_COOKIE = "nova_gmail_oauth";
export const OAUTH_COOKIE_PATH = "/api/google";

export type OAuthState = { state: string; tenantId: string; slug: string };

export const newState = () => randomBytes(24).toString("base64url");

export const callbackUrl = async () => `${await getAppOrigin()}${GMAIL_CALLBACK_PATH}`;

export const cookieOptions = (origin: string) => ({
  httpOnly: true,
  secure: origin.startsWith("https://"),
  sameSite: "lax" as const, // Rückleitung von Google ist eine Top-Level-Navigation
  path: OAUTH_COOKIE_PATH,
  maxAge: 600,
});

export const parseState = (raw: string | undefined): OAuthState | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthState>;
    return typeof value.state === "string" && typeof value.tenantId === "string" && typeof value.slug === "string" ? (value as OAuthState) : null;
  } catch {
    return null;
  }
};

export const sameState = (expected: string, received: string | null) =>
  received !== null && expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
