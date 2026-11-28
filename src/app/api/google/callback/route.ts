import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/app-origin";
import { createSupabaseServerClient, financeSchema } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { encryptToken, exchangeCode, GmailError } from "@/modules/finance/server/gmail";
import { callbackUrl, cookieOptions, OAUTH_COOKIE, parseState, sameState } from "@/modules/finance/server/gmail-flow";

/** Rückleitung von Google nach „Mit Gmail verbinden“. */
export async function GET(request: NextRequest) {
  const origin = await getAppOrigin();
  const saved = parseState(request.cookies.get(OAUTH_COOKIE)?.value);
  const params = request.nextUrl.searchParams;

  const finish = (result: string, slug = saved?.slug) => {
    const target = slug ? `${origin}${tenantBasePath(slug)}/finanzen/einstellungen?gmail=${result}` : `${origin}/app`;
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(OAUTH_COOKIE, "", { ...cookieOptions(origin), maxAge: 0 });
    return response;
  };

  if (!saved || !sameState(saved.state, params.get("state"))) return finish("abgelaufen");
  if (params.get("error")) return finish("abgebrochen");
  const code = params.get("code");
  if (!code || !(await getCurrentUser())) return finish("abgelaufen");
  const tenant = await getTenantWithPermission(saved.tenantId, "finance.manage");
  if (!tenant) return finish("abgelaufen");

  try {
    const { email, refreshToken } = await exchangeCode(code, await callbackUrl());
    const { error } = await financeSchema(await createSupabaseServerClient()).rpc("connect_mail_account", {
      p_tenant: tenant.id,
      p_email: email,
      p_token_enc: encryptToken(refreshToken),
    });
    if (error) return finish("fehler", tenant.slug);
    return finish("verbunden", tenant.slug);
  } catch (error) {
    return finish(error instanceof GmailError && error.code === "scope" ? "rechte" : "fehler", tenant.slug);
  }
}
