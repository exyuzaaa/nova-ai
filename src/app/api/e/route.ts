import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { MAX_PAYLOAD_BYTES } from "@/modules/analytics/domain/event-payload";
import { buildIngestEvent } from "@/modules/analytics/server/ingestion/build-event";
import { createRateLimiter } from "@/modules/analytics/server/ingestion/rate-limit";

/**
 * Öffentlicher Collect-Endpunkt des Tracking-Skripts.
 * Antwortet immer mit 202 (ohne Details), damit Angreifer nichts über Websites erfahren.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

const accepted = () => new Response(null, { status: 202, headers: CORS_HEADERS });
const perVisitor = createRateLimiter({ limit: 60, windowMs: 10_000 });

const clientIp = (request: NextRequest): string | null =>
  request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new Response(null, { status: 503, headers: CORS_HEADERS });

  const body = await request.text();
  if (body.length === 0 || body.length > MAX_PAYLOAD_BYTES) return accepted();

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return accepted();
  }

  const ip = clientIp(request);
  const result = buildIngestEvent(raw, {
    ip,
    userAgent: request.headers.get("user-agent") ?? "",
    gpc: request.headers.get("sec-gpc") === "1",
    country: request.headers.get("x-vercel-ip-country"),
    region: request.headers.get("x-vercel-ip-country-region"),
    city: request.headers.get("x-vercel-ip-city"),
  });
  if (!result.ok) return accepted();
  if (!perVisitor(`${ip}|${result.event.site_id}`)) return accepted();

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("nova_ingest_event", { p: result.event });
  if (error) console.error("[analytics] Ingestion fehlgeschlagen", error.code, error.message);
  else if (data !== "ok" && process.env.NODE_ENV !== "production") console.info("[analytics] Event verworfen:", data);
  return accepted();
}
