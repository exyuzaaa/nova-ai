import { NextResponse, type NextRequest } from "next/server";
import { getAppOrigin } from "@/lib/app-origin";
import { getCurrentUser } from "@/modules/auth/server/session";
import { tenantBasePath } from "@/modules/core/config/navigation";
import { getTenantWithPermission } from "@/modules/core/server/permissions";
import { listMyTenants } from "@/modules/core/server/tenants";
import { authorizationUrl, isGmailConfigured } from "@/modules/finance/server/gmail";
import { callbackUrl, cookieOptions, newState, OAUTH_COOKIE } from "@/modules/finance/server/gmail-flow";

/** Startet „Mit Gmail verbinden“ (nur mit dem Recht „Finanzen verwalten“). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/app/[tenant]/finanzen/gmail/verbinden">) {
  const origin = await getAppOrigin();
  const { tenant: slug } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/app/${slug}/finanzen/einstellungen`)}`, origin));
  const found = (await listMyTenants()).find((entry) => entry.slug === decodeURIComponent(slug));
  const tenant = found && (await getTenantWithPermission(found.id, "finance.manage"));
  if (!tenant) return new Response("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });
  const settings = `${origin}${tenantBasePath(tenant.slug)}/finanzen/einstellungen`;
  if (!isGmailConfigured()) return NextResponse.redirect(`${settings}?gmail=config`);

  const state = newState();
  const response = NextResponse.redirect(authorizationUrl(state, await callbackUrl()));
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, tenantId: tenant.id, slug: tenant.slug }), cookieOptions(origin));
  return response;
}
