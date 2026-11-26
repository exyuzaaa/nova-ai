-- =============================================================================
-- NOVA ANALYTICS – Event-Erfassung (Phase 4)
-- -----------------------------------------------------------------------------
-- public.nova_ingest_event() ist der einzige Schreibweg für Besucherdaten.
-- Sie ist für die Rolle anon ausführbar (der Collect-Endpunkt nutzt nur den
-- Publishable Key), prüft aber selbst: aktive Website, passende Domain,
-- Tracking-Einstellungen, Größenlimits. Die IP-Adresse wird nur zur Bildung
-- eines täglich wechselnden Hashes verwendet und nie gespeichert.
-- =============================================================================

-- Tägliche Salts für den cookielosen Besucher-Hash. Nach 2 Tagen gelöscht →
-- ältere Hashes sind keiner Person mehr zuordenbar.
create table analytics.daily_salts (
  day        date primary key,
  salt       bytea not null,
  created_at timestamptz not null default now()
);
alter table analytics.daily_salts enable row level security;
revoke all on analytics.daily_salts from public, anon, authenticated, service_role;

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
                                      'form_start', 'form_submit', 'scroll', 'phone_click', 'email_click') then
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

-- -----------------------------------------------------------------------------
-- Installationsstatus für die Einstellungen (nur mit Zugriff auf die Website)
-- -----------------------------------------------------------------------------
create or replace function analytics.tracking_status(p_website uuid)
returns table (events_24h bigint, pageviews_24h bigint, sessions_24h bigint, last_event_at timestamptz, last_path text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_website not in (select analytics.accessible_website_ids('viewer')) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
    select
      count(*),
      count(*) filter (where e.event_type = 'pageview'),
      count(distinct e.session_id),
      max(e.received_at),
      (select x.pathname from analytics.analytics_events x
       where x.website_id = p_website order by x.received_at desc limit 1)
    from analytics.analytics_events e
    where e.website_id = p_website and e.occurred_at > now() - interval '24 hours';
end $$;
revoke all on function analytics.tracking_status(uuid) from public, anon;
grant execute on function analytics.tracking_status(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Wartung: alte Salts löschen, Partitionen anlegen, Aufbewahrung (pg_cron)
-- -----------------------------------------------------------------------------
create or replace function analytics.purge_daily_salts()
returns void language sql security definer set search_path = '' as $$
  delete from analytics.daily_salts where day < current_date - 1;
$$;
revoke all on function analytics.purge_daily_salts() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule('nova-analytics-salts', '5 0 * * *', 'select analytics.purge_daily_salts()');
select cron.schedule('nova-analytics-partitions', '15 3 * * *', 'select analytics.ensure_partitions(3)');
select cron.schedule('nova-analytics-retention', '30 3 * * *', 'select analytics.purge_expired_raw_data()');
