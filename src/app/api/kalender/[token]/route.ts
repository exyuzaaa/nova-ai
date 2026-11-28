import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { buildIcs, type RepeatFrequency } from "@/modules/calendar/domain/calendar";
import { toIcsEvent } from "@/modules/calendar/server/ics";

/**
 * Kalender-Abo (iCal) für Outlook, Google oder Apple Kalender.
 * Ohne Anmeldung, nur mit dem geheimen Link; die Datenbank prüft den Token (nur als Hash
 * gespeichert), die Mitgliedschaft und ob das Kalendermodul aktiv ist.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/kalender/[token]">) {
  const { token } = await ctx.params;
  const clean = token.replace(/\.ics$/, "");
  const notFound = new Response("Nicht gefunden", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!/^[0-9a-f]{48}$/.test(clean)) return notFound;

  const { url, publishableKey } = getSupabaseEnv();
  const supabase = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.schema("calendar").rpc("feed_events", { p_token: clean });
  if (error) return new Response("Vorübergehend nicht verfügbar", { status: 503, headers: { "Cache-Control": "no-store" } });
  // Unbekannte oder widerrufene Links liefern einen leeren Kalender (keine Auskunft, ob ein Link existiert);
  // Kalender-Apps entfernen dann die bisher abonnierten Termine.
  const timeZone = data[0]?.timezone ?? "Europe/Berlin";
  const ics = buildIcs(
    data[0] ? `NOVA – ${data[0].tenant_name}` : "NOVA",
    data.map((row) =>
      toIcsEvent(
        {
          id: row.event_id,
          title: row.title,
          description: row.description,
          location: row.location,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          allDay: row.all_day,
          repeatFreq: (row.repeat_freq as RepeatFrequency | null) ?? null,
          repeatInterval: row.repeat_interval,
          repeatWeekdays: row.repeat_weekdays,
          repeatUntil: row.repeat_until,
          repeatCount: row.repeat_count,
          exceptionDates: row.exception_dates,
          updatedAt: row.updated_at,
        },
        timeZone,
      ),
    ),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nova.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
