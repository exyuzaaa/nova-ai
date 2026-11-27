/**
 * Ziel nach Anmeldung/Bestätigung. Nur relative Pfade innerhalb der App sind
 * erlaubt – verhindert offene Weiterleitungen auf fremde Domains.
 */
export const DEFAULT_AFTER_LOGIN = "/app";

export const safeNextPath = (value: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://nova.invalid");
    if (parsed.origin !== "http://nova.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
};

/** Bereiche, die eine Anmeldung voraussetzen. */
export const PROTECTED_PREFIXES = ["/app", "/analytics", "/onboarding", "/passwort-neu"] as const;

/** Seiten, die angemeldete Nutzer nicht mehr brauchen. */
export const GUEST_ONLY_PATHS = ["/login", "/registrieren", "/passwort-vergessen"] as const;

export const isProtectedPath = (pathname: string): boolean =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const isGuestOnlyPath = (pathname: string): boolean =>
  (GUEST_ONLY_PATHS as readonly string[]).includes(pathname);
