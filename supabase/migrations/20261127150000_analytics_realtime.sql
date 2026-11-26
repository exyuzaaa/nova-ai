-- =============================================================================
-- NOVA ANALYTICS – Echtzeit und Besucheranalyse (Phase 6)
-- -----------------------------------------------------------------------------
-- 1. Heartbeats: Das Tracking-Skript meldet alle 30 s, solange die Seite sichtbar
--    ist. Ein Heartbeat verlängert nur die laufende Session (last_activity_at) und
--    erzeugt keine Event-Zeile.
-- 2. site_realtime(): Momentaufnahme für die Echtzeit-Ansicht.
--    „Gerade aktiv“ = Signal in den letzten 90 Sekunden (3 Heartbeat-Intervalle).
-- 3. site_session_distribution(): Verteilung von Sitzungsdauer und Seitentiefe.
-- =============================================================================

create or replace function public.nova_ingest_event(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_site      record;
  v_type      text := p ->> 'type';
  v_name      text := left(coalesce(nullif(p ->> 'name', ''), p ->> 'type'), 80);
  v_host      text := lower(regexp_replace(coalesce(p ->> 'hostname', ''), '^www\.', ''));
  v_path      text := left(coalesce(nullif(p ->> 'pathname', ''), '/'), 2048);
  v_salt      bytea;
  v_hash      bytea;
  v_session   record;
  v_session_id uuid;
  v_started   timestamptz;
  v_now       timestamptz := now();
  v_props     jsonb := coalesce(p -> 'props', '{}'::jsonb);
  v_engage    integer := least(greatest(coalesce((p ->> 'engagement_ms')::integer, 0), 0), 1800000);
  v_new_campaign boolean;
begin
  -- Grundprüfungen ----------------------------------------------------------
  if v_type is null or v_type not in ('pageview', 'engagement', 'custom', 'outbound_click', 'download',
                                      'form_start', 'form_submit', 'scroll', 'phone_click', 'email_click',
                                      'heartbeat') then
    return 'invalid';
  end if;
  if coalesce(p ->> 'ip', '') = '' or coalesce(p ->> 'site_id', '') !~ '^ns_[a-f0-9]{16}$' then
    return 'invalid';
  end if;
  if jsonb_typeof(v_props) <> 'object' or length(v_props::text) > 4000 then
    v_props := '{}'::jsonb;
  end if;

  select w.id, w.organization_id, w.domain, w.additional_domains, s.*
  into v_site
  from analytics.websites w
  join analytics.organizations o on o.id = w.organization_id and o.deleted_at is null
  join analytics.tracking_settings s on s.website_id = w.id
  where w.public_site_id = p ->> 'site_id' and w.status = 'active' and w.deleted_at is null;
  if not found then
    return 'unknown_site';
  end if;

  -- Nur Events von der eigenen Domain (inkl. Subdomains und Zusatzdomains)
  if not (v_host = v_site.domain or v_host like '%.' || v_site.domain
          or v_host = any (v_site.additional_domains)) then
    return 'domain_mismatch';
  end if;

  -- Einstellungen der Website respektieren -----------------------------------
  if v_site.respect_gpc_dnt and coalesce((p ->> 'gpc')::boolean, false) then
    return 'ignored';
  end if;
  if v_site.tracking_mode = 'consent_required' and not coalesce((p ->> 'consent')::boolean, false) then
    return 'ignored';
  end if;
  if (v_type = 'outbound_click' and not v_site.track_outbound_clicks)
     or (v_type = 'download' and not v_site.track_downloads)
     or (v_type in ('phone_click', 'email_click') and not v_site.track_contact_clicks)
     or (v_type in ('form_start', 'form_submit') and not v_site.track_form_interactions)
     or (v_type = 'scroll' and not v_site.track_scroll_depth) then
    return 'ignored';
  end if;
  if exists (select 1 from unnest(v_site.excluded_paths) x where v_path like x || '%') then
    return 'ignored';
  end if;

  -- Besucher-Hash (täglicher Salt, IP wird nicht gespeichert) -----------------
  select salt into v_salt from analytics.daily_salts where day = current_date;
  if v_salt is null then
    insert into analytics.daily_salts (day, salt)
    values (current_date, extensions.gen_random_bytes(32))
    on conflict (day) do nothing;
    select salt into v_salt from analytics.daily_salts where day = current_date;
  end if;
  v_hash := substring(extensions.digest(
    v_salt || convert_to(v_site.id::text || '|' || (p ->> 'ip') || '|' || coalesce(p ->> 'user_agent', ''), 'UTF8'),
    'sha256') from 1 for 16);

  -- Heartbeat: hält eine laufende Session aktiv (Echtzeit), speichert kein Event ---
  if v_type = 'heartbeat' then
    update analytics.analytics_sessions
    set last_activity_at = v_now
    where website_id = v_site.id and visitor_hash = v_hash and closed_at is null
      and started_at > v_now - interval '1 day'
      and last_activity_at > v_now - make_interval(mins => v_site.session_timeout_minutes);
    return case when found then 'ok' else 'ignored' end;
  end if;

  -- Session finden oder anlegen -------------------------------------------------
  select id, started_at, utm_campaign, utm_source into v_session
  from analytics.analytics_sessions
  where website_id = v_site.id and visitor_hash = v_hash and closed_at is null
    and last_activity_at > v_now - make_interval(mins => v_site.session_timeout_minutes)
  order by last_activity_at desc
  limit 1
  for update;

  v_new_campaign := found and (
    (p ->> 'utm_campaign' is not null and p ->> 'utm_campaign' is distinct from v_session.utm_campaign)
    or (p ->> 'utm_source' is not null and p ->> 'utm_source' is distinct from v_session.utm_source));

  if not found or v_new_campaign then
    if v_type = 'engagement' then
      return 'ignored';  -- Engagement ohne laufende Session ist bedeutungslos
    end if;
    v_session_id := gen_random_uuid();
    v_started := v_now;
    insert into analytics.analytics_sessions (
      id, started_at, last_activity_at, website_id, organization_id, visitor_hash, visitor_id_type,
      entry_path, exit_path, channel, referrer_host,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      country_code, region_code, city, device_type, browser, os)
    values (
      v_session_id, v_started, v_now, v_site.id, v_site.organization_id, v_hash, 'daily_hash',
      v_path, v_path, coalesce((p ->> 'channel')::analytics.traffic_channel, 'unassigned'), p ->> 'referrer_host',
      p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign', p ->> 'utm_content', p ->> 'utm_term',
      p ->> 'country_code',
      case when v_site.geo_granularity in ('region', 'city') then p ->> 'region_code' end,
      case when v_site.geo_granularity = 'city' then p ->> 'city' end,
      p ->> 'device_type', p ->> 'browser', p ->> 'os');
  else
    v_session_id := v_session.id;
    v_started := v_session.started_at;
  end if;

  update analytics.analytics_sessions
  set last_activity_at = v_now,
      exit_path = case when v_type = 'pageview' then v_path else exit_path end,
      pageviews = pageviews + (v_type = 'pageview')::int,
      events = events + 1,
      engagement_ms = engagement_ms + v_engage
  where id = v_session_id and started_at = v_started;

  -- Event speichern ---------------------------------------------------------------
  insert into analytics.analytics_events (
    occurred_at, received_at, website_id, organization_id, session_id, visitor_hash, visitor_id_type,
    event_type, event_name, hostname, pathname, referrer_host, referrer_path, channel,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id_type,
    country_code, region_code, city, device_type, browser, os, engagement_ms, scroll_depth, props)
  values (
    v_now, v_now, v_site.id, v_site.organization_id, v_session_id, v_hash, 'daily_hash',
    v_type, v_name, v_host, v_path, p ->> 'referrer_host', p ->> 'referrer_path',
    coalesce((p ->> 'channel')::analytics.traffic_channel, 'unassigned'),
    p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign', p ->> 'utm_content', p ->> 'utm_term',
    p ->> 'click_id_type',
    p ->> 'country_code',
    case when v_site.geo_granularity in ('region', 'city') then p ->> 'region_code' end,
    case when v_site.geo_granularity = 'city' then p ->> 'city' end,
    p ->> 'device_type', p ->> 'browser', p ->> 'os',
    nullif(v_engage, 0),
    case when v_type = 'scroll' then least(greatest((p ->> 'scroll_depth')::smallint, 0), 100) end,
    v_props);

  -- Register der Custom-Event-Namen (max. 500 je Website) -------------------------
  if v_type = 'custom' then
    update analytics.custom_events set last_seen_at = v_now
    where website_id = v_site.id and event_name = v_name;
    if not found and (select count(*) from analytics.custom_events where website_id = v_site.id) < 500 then
      insert into analytics.custom_events (website_id, event_name) values (v_site.id, v_name)
      on conflict do nothing;
    end if;
  end if;

  return 'ok';
end $$;

revoke all on function public.nova_ingest_event(jsonb) from public, authenticated;
grant execute on function public.nova_ingest_event(jsonb) to anon, service_role;

create index if not exists analytics_sessions_site_activity_idx
  on analytics.analytics_sessions (website_id, last_activity_at desc);

create or replace function analytics.site_realtime(p_website uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_now    timestamptz := now();
  v_result jsonb;
begin
  perform analytics.assert_site_access(p_website);

  with recent_sessions as (
    select * from analytics.analytics_sessions
    where website_id = p_website and started_at > v_now - interval '1 day'
      and last_activity_at > v_now - interval '30 minutes'
  ),
  recent_events as (
    select * from analytics.analytics_events
    where website_id = p_website and occurred_at > v_now - interval '30 minutes'
  ),
  minutes as (
    select generate_series(0, 29) as m
  ),
  per_minute as (
    select coalesce(jsonb_agg(coalesce(c.n, 0) order by minutes.m desc), '[]'::jsonb) as counts
    from minutes
    left join (
      select floor(extract(epoch from (v_now - occurred_at)) / 60)::int as m, count(*) as n
      from recent_events where event_type = 'pageview' group by 1
    ) c on c.m = minutes.m
  )
  select jsonb_build_object(
    'generated_at', v_now,
    'active_now', (select count(distinct visitor_hash) from recent_sessions
                   where last_activity_at > v_now - interval '90 seconds'),
    'active_30m', (select count(distinct visitor_hash) from recent_sessions),
    'sessions_30m', (select count(*) from recent_sessions where started_at > v_now - interval '30 minutes'),
    'pageviews_30m', (select count(*) from recent_events where event_type = 'pageview'),
    'events_30m', (select count(*) from recent_events where event_type not in ('pageview', 'engagement', 'scroll')),
    'pageviews_per_minute', (select counts from per_minute),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'visitors', n) order by n desc, k), '[]'::jsonb)
              from (select exit_path as k, count(distinct visitor_hash) as n from recent_sessions
                    where last_activity_at > v_now - interval '5 minutes' group by 1 order by 2 desc, 1 limit 8) x),
    'channels', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'visitors', n) order by n desc, k), '[]'::jsonb)
                 from (select channel::text as k, count(distinct visitor_hash) as n from recent_sessions
                       group by 1 order by 2 desc, 1 limit 8) x),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'visitors', n) order by n desc, k), '[]'::jsonb)
                  from (select coalesce(country_code, 'ZZ') as k, count(distinct visitor_hash) as n from recent_sessions
                        group by 1 order by 2 desc, 1 limit 8) x),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'visitors', n) order by n desc, k), '[]'::jsonb)
                from (select coalesce(device_type, 'other') as k, count(distinct visitor_hash) as n from recent_sessions
                      group by 1 order by 2 desc, 1 limit 8) x),
    'recent_events', (select coalesce(jsonb_agg(jsonb_build_object(
                         'type', event_type, 'name', event_name, 'path', pathname, 'at', occurred_at) order by occurred_at desc), '[]'::jsonb)
                      from (select event_type, event_name, pathname, occurred_at from recent_events
                            where event_type not in ('pageview', 'engagement', 'scroll')
                            order by occurred_at desc limit 10) x)
  ) into v_result;
  return v_result;
end $$;

create or replace function analytics.site_session_distribution(p_website uuid, p_start date, p_end date)
returns table (kind text, bucket text, sessions bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz   text := analytics.assert_site_access(p_website);
  v_from timestamptz;
  v_to   timestamptz;
begin
  if p_end < p_start or p_end - p_start > 800 then
    raise exception 'Ungültiger Zeitraum' using errcode = '22023';
  end if;
  v_from := p_start::timestamp at time zone v_tz;
  v_to := (p_end + 1)::timestamp at time zone v_tz;

  return query
    with s as (
      select engagement_ms, pageviews from analytics.analytics_sessions
      where website_id = p_website and started_at >= v_from and started_at < v_to
    ),
    buckets(kind, bucket, position) as (
      values ('duration', 'lt10', 1), ('duration', '10_30', 2), ('duration', '30_60', 3),
             ('duration', '60_180', 4), ('duration', '180_600', 5), ('duration', 'gt600', 6),
             ('depth', '1', 1), ('depth', '2', 2), ('depth', '3_4', 3), ('depth', '5_9', 4), ('depth', '10p', 5)
    ),
    counted as (
      select 'duration' as kind,
             case when engagement_ms < 10000 then 'lt10' when engagement_ms < 30000 then '10_30'
                  when engagement_ms < 60000 then '30_60' when engagement_ms < 180000 then '60_180'
                  when engagement_ms < 600000 then '180_600' else 'gt600' end as bucket,
             count(*) as n
      from s group by 1, 2
      union all
      select 'depth',
             case when pageviews <= 1 then '1' when pageviews = 2 then '2' when pageviews <= 4 then '3_4'
                  when pageviews <= 9 then '5_9' else '10p' end,
             count(*)
      from s group by 1, 2
    )
    select b.kind, b.bucket, coalesce(c.n, 0)
    from buckets b left join counted c on c.kind = b.kind and c.bucket = b.bucket
    order by b.kind desc, b.position;
end $$;

revoke all on function analytics.site_realtime(uuid) from public, anon;
revoke all on function analytics.site_session_distribution(uuid, date, date) from public, anon;
grant execute on function analytics.site_realtime(uuid) to authenticated;
grant execute on function analytics.site_session_distribution(uuid, date, date) to authenticated;
