import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { needsSecondFactor } from "@/modules/auth/domain/mfa";
import { DEFAULT_AFTER_LOGIN, isGuestOnlyPath, isProtectedPath, SECOND_FACTOR_PATH } from "@/modules/auth/domain/redirects";

/**
 * Erneuert die Supabase-Sitzung bei jeder Anfrage und schützt Bereiche, die eine
 * Anmeldung voraussetzen. Das ist eine Komfort- und Erstprüfung – die eigentliche
 * Autorisierung erfolgt zusätzlich serverseitig (Data Access Layer) und per RLS.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // Ohne Konfiguration keine geschützten Seiten ausliefern.
    return isProtectedPath(request.nextUrl.pathname)
      ? new NextResponse("Supabase ist nicht konfiguriert.", { status: 503 })
      : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    // Erneuerte Sitzungs-Cookies auch bei Weiterleitungen mitgeben.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(login);
  }

  // Zweiter Faktor eingerichtet, aber noch nicht bestätigt → Code abfragen.
  // (Die Datenbank sperrt Unternehmensdaten in diesem Zustand zusätzlich selbst.)
  if (isAuthenticated && isProtectedPath(pathname) && data?.claims?.aal !== "aal2") {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsSecondFactor(level)) {
      const verify = new URL(SECOND_FACTOR_PATH, request.url);
      verify.searchParams.set("next", `${pathname}${search}`);
      return redirectTo(verify);
    }
  }

  if (isAuthenticated && isGuestOnlyPath(pathname)) {
    return redirectTo(new URL(DEFAULT_AFTER_LOGIN, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/e$|tracker\\.js$|tracking-test|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)"],
};
