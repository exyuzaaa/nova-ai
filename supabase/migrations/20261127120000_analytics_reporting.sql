-- =============================================================================
-- NOVA ANALYTICS – Auswertung (Phase 5)
-- -----------------------------------------------------------------------------
-- Lesefunktionen für das Dashboard. Sie rechnen serverseitig in der Datenbank,
-- in der Zeitzone der Website, und prüfen den Zugriff des angemeldeten Nutzers.
--
-- Besucher: Im cookielosen Modus wechselt der Besucher-Hash täglich. Eindeutige
-- Besucher eines Zeitraums sind daher die Summe der täglich eindeutigen
-- Besucher – dieselbe Person an zwei Tagen zählt zweimal (Architektur §2.6).
--
-- Absprung: Session mit höchstens einem Seitenaufruf, unter 10 s aktiver Zeit
-- und ohne Conversion.
-- =============================================================================

create or replace function analytics.assert_site_access(p_website uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
begin
  if p_website is null or p_website not in (select analytics.accessible_website_ids('viewer')) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  select timezone into v_tz from analytics.websites where id = p_website;
  return v_tz;
end $$;
revoke all on function analytics.assert_site_access(uuid) from public, anon, authenticated;

-- Tageswerte im Zeitraum [p_start, p_end] (Kalendertage in der Zeitzone der Website)
create or replace function analytics.site_daily_stats(p_website uuid, p_start date, p_end date)
returns table (
  day           date,
  visitors      bigint,
  sessions      bigint,
  pageviews     bigint,
  bounces       bigint,
  engagement_ms bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz    text := analytics.assert_site_access(p_website);
  v_from  timestamptz;
  v_to    timestamptz;
begin
  if p_end < p_start or p_end - p_start > 800 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;
  v_from := p_start::timestamp at time zone v_tz;
  v_to := (p_end + 1)::timestamp at time zone v_tz;

  return query
    with days as (
      select generate_series(p_start, p_end, interval '1 day')::date as day
    ),
    s as (
      select (x.started_at at time zone v_tz)::date as day,
             count(distinct x.visitor_hash) as visitors,
             count(*) as sessions,
             count(*) filter (where x.pageviews <= 1 and x.engagement_ms < 10000 and x.conversion_count = 0) as bounces,
             coalesce(sum(x.engagement_ms), 0)::bigint as engagement_ms
      from analytics.analytics_sessions x
      where x.website_id = p_website and x.started_at >= v_from and x.started_at < v_to
      group by 1
    ),
    e as (
      select (y.occurred_at at time zone v_tz)::date as day, count(*) as pageviews
      from analytics.analytics_events y
      where y.website_id = p_website and y.event_type = 'pageview'
        and y.occurred_at >= v_from and y.occurred_at < v_to
      group by 1
    )
    select d.day,
           coalesce(s.visitors, 0), coalesce(s.sessions, 0), coalesce(e.pageviews, 0),
           coalesce(s.bounces, 0), coalesce(s.engagement_ms, 0)
    from days d
    left join s on s.day = d.day
    left join e on e.day = d.day
    order by d.day;
end $$;

-- Aufschlüsselung nach Dimension (Top-N nach Besuchern bzw. Seitenaufrufen)
create or replace function analytics.site_breakdown(
  p_website uuid, p_start date, p_end date, p_dimension text, p_limit integer default 8
)
returns table (key text, visitors bigint, pageviews bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz    text := analytics.assert_site_access(p_website);
  v_from  timestamptz;
  v_to    timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 8), 1), 100);
begin
  if p_end < p_start or p_end - p_start > 800 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;
  v_from := p_start::timestamp at time zone v_tz;
  v_to := (p_end + 1)::timestamp at time zone v_tz;

  if p_dimension = 'page' then
    return query
      select y.pathname, count(distinct y.visitor_hash), count(*)
      from analytics.analytics_events y
      where y.website_id = p_website and y.event_type = 'pageview'
        and y.occurred_at >= v_from and y.occurred_at < v_to
      group by 1 order by 3 desc, 1 limit v_limit;
    return;
  end if;

  if p_dimension not in ('channel', 'source', 'entry_page', 'country', 'device', 'browser', 'os') then
    raise exception 'Unbekannte Dimension' using errcode = '22023';
  end if;

  return query
    select k.key, count(distinct k.visitor_hash), coalesce(sum(k.pageviews), 0)::bigint
    from (
      select x.visitor_hash, x.pageviews,
             case p_dimension
               when 'channel' then x.channel::text
               when 'source' then coalesce(x.utm_source, x.referrer_host, '(direkt)')
               when 'entry_page' then x.entry_path
               when 'country' then coalesce(x.country_code, 'ZZ')
               when 'device' then coalesce(x.device_type, 'other')
               when 'browser' then coalesce(x.browser, 'Sonstige')
               when 'os' then coalesce(x.os, 'Sonstige')
             end as key
      from analytics.analytics_sessions x
      where x.website_id = p_website and x.started_at >= v_from and x.started_at < v_to
    ) k
    group by 1 order by 2 desc, 1 limit v_limit;
end $$;

-- Hat die Website überhaupt Daten? (für den Einstieg „Tracking einbauen“)
create or replace function analytics.site_has_data(p_website uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  perform analytics.assert_site_access(p_website);
  return exists (select 1 from analytics.analytics_sessions where website_id = p_website);
end $$;

revoke all on function analytics.site_daily_stats(uuid, date, date) from public, anon;
revoke all on function analytics.site_breakdown(uuid, date, date, text, integer) from public, anon;
revoke all on function analytics.site_has_data(uuid) from public, anon;
grant execute on function analytics.site_daily_stats(uuid, date, date) to authenticated;
grant execute on function analytics.site_breakdown(uuid, date, date, text, integer) to authenticated;
grant execute on function analytics.site_has_data(uuid) to authenticated;
