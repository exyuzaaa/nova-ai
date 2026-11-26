import "server-only";
import { headers } from "next/headers";

/** Öffentliche Basis-URL der App (APP_URL, sonst aus der aktuellen Anfrage). */
export const getAppOrigin = async (): Promise<string> => {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
};
