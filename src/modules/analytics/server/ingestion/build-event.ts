import { classifyChannel } from "../../domain/channels";
import { trackerPayloadSchema, sanitizeProps } from "../../domain/event-payload";
import { parsePageUrl, parseReferrer } from "../../domain/url-sanitize";
import { isBot, parseUserAgent } from "../../domain/user-agent";

export type RequestContext = {
  ip: string | null;
  userAgent: string;
  gpc: boolean;
  country: string | null;
  region: string | null;
  city: string | null;
};

export type BuildResult =
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; reason: "invalid" | "bot" | "no_ip" };

const decodeHeader = (value: string | null): string | null => {
  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
};

/** Normalisierte Daten für public.nova_ingest_event aus Rohdaten und Request-Kontext. */
export const buildIngestEvent = (raw: unknown, context: RequestContext): BuildResult => {
  const parsed = trackerPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  if (isBot(context.userAgent)) return { ok: false, reason: "bot" };
  if (!context.ip) return { ok: false, reason: "no_ip" };

  const payload = parsed.data;
  const page = parsePageUrl(payload.u);
  if (!page) return { ok: false, reason: "invalid" };
  if (payload.t === "custom" && !payload.n) return { ok: false, reason: "invalid" };

  const referrer = parseReferrer(payload.r, page.hostname);
  const agent = parseUserAgent(context.userAgent, payload.w);
  const country = context.country && /^[A-Z]{2}$/.test(context.country) ? context.country : null;

  return {
    ok: true,
    event: {
      site_id: payload.s,
      type: payload.t,
      name: payload.t === "custom" ? payload.n : payload.t,
      hostname: page.hostname,
      pathname: page.pathname,
      referrer_host: referrer?.host ?? null,
      referrer_path: referrer?.path ?? null,
      ...page.utm,
      click_id_type: page.clickIdType,
      channel: classifyChannel({
        referrerHost: referrer?.host ?? null,
        utmSource: page.utm.utm_source ?? null,
        utmMedium: page.utm.utm_medium ?? null,
        clickIdType: page.clickIdType,
      }),
      country_code: country,
      region_code: country ? decodeHeader(context.region) : null,
      city: country ? decodeHeader(context.city) : null,
      device_type: agent.deviceType,
      browser: agent.browser,
      os: agent.os,
      engagement_ms: payload.e ?? null,
      scroll_depth: payload.d ?? null,
      props: sanitizeProps(payload.p).props,
      gpc: context.gpc,
      consent: payload.c ?? false,
      // Nur zur Hash-Bildung in der Datenbank; wird dort nicht gespeichert.
      ip: context.ip,
      user_agent: context.userAgent.slice(0, 512),
    },
  };
};
