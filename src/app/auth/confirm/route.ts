import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/auth/domain/redirects";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "invite", "email_change"];

/**
 * Ziel der Links aus Bestätigungs- und Passwort-E-Mails (token_hash-Verfahren).
 * Funktioniert geräteübergreifend, weil kein PKCE-Code-Verifier im Browser nötig ist.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/passwort-neu" : "/onboarding";
  const next = safeNextPath(searchParams.get("next"), fallback);

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Nach der Registrierung über eine Einladung dorthin zurückkehren.
      const signupNext = type === "recovery" ? null : data.user?.user_metadata?.signup_next;
      const target = signupNext ? safeNextPath(signupNext, next) : next;
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  const failure = new URL("/login", request.url);
  failure.searchParams.set("fehler", "link-ungueltig");
  return NextResponse.redirect(failure);
}
