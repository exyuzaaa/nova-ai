-- =============================================================================
-- NOVA ANALYTICS – Datenbanktests: Auswertungsfunktionen (Phase 5)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'fremd@example.com', now(), 'authenticated', 'authenticated');
insert into analytics.organizations (id, name, slug) values ('11111111-0000-4000-8000-000000000001', 'Org', 'org-report');
insert into analytics.organization_members (organization_id, user_id, role)
  values ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'viewer');
insert into analytics.websites (id, organization_id, name, domain, timezone)
  values ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Site', 'report.example', 'Europe/Berlin');

-- Drei Sessions am 10.06.2026 (Berlin), eine davon um 23:30 Ortszeit (= 21:30 UTC),
-- eine Session am 11.06.2026 um 00:30 Ortszeit (= 10.06. 22:30 UTC → gehört zum 11.06.).
create table analytics.analytics_sessions_test_2026_06 partition of analytics.analytics_sessions
  for values from ('2026-06-01') to ('2026-07-01');
create table analytics.analytics_events_test_2026_06 partition of analytics.analytics_events
  for values from ('2026-06-01') to ('2026-07-01');
create temp table s_data as
select * from (values
  ('33333333-0000-4000-8000-000000000001'::uuid, '2026-06-10 08:00+00'::timestamptz, '\x01'::bytea, 3, 60000::bigint, 'organic_search', 'google.de', null::text, '/', 'DE', 'desktop', 'Chrome', 'Windows'),
  ('33333333-0000-4000-8000-000000000002', '2026-06-10 12:00+00', '\x02', 1, 2000, 'direct', null, null, '/preise', 'AT', 'mobile', 'Safari', 'iOS'),
  ('33333333-0000-4000-8000-000000000003', '2026-06-10 21:30+00', '\x01', 1, 45000, 'email', null, 'newsletter', '/', 'DE', 'desktop', 'Chrome', 'Windows'),
  ('33333333-0000-4000-8000-000000000004', '2026-06-10 22:30+00', '\x03', 1, 1000, 'direct', null, null, '/kontakt', null, 'mobile', 'Chrome', 'Android')
) v(id, started, hash, pv, engage, channel, ref, utm, entry, country, device, browser, os);

insert into analytics.analytics_sessions (id, started_at, last_activity_at, website_id, organization_id, visitor_hash,
  visitor_id_type, entry_path, pageviews, engagement_ms, channel, referrer_host, utm_source, country_code, device_type, browser, os)
select id, started, started, '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', hash,
  'daily_hash', entry, pv, engage, channel::analytics.traffic_channel, ref, utm, country, device, browser, os
from s_data;

insert into analytics.analytics_events (occurred_at, website_id, organization_id, session_id, visitor_hash, visitor_id_type,
  event_type, event_name, hostname, pathname)
select started + make_interval(secs => g), '22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001',
  id, hash, 'daily_hash', 'pageview', 'pageview', 'report.example', case when g = 0 then entry else '/leistungen' end
from s_data, lateral generate_series(0, pv - 1) g;

-- Als Viewer der Organisation abfragen
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  $$select day, visitors, sessions, pageviews, bounces, engagement_ms
    from analytics.site_daily_stats('22222222-0000-4000-8000-000000000002', '2026-06-09', '2026-06-11')$$,
  $$values ('2026-06-09'::date, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint),
           ('2026-06-10'::date, 2::bigint, 3::bigint, 5::bigint, 1::bigint, 107000::bigint),
           ('2026-06-11'::date, 1::bigint, 1::bigint, 1::bigint, 1::bigint, 1000::bigint)$$,
  'Tageswerte in der Zeitzone der Website, Tage ohne Daten mit 0');

select results_eq(
  $$select key, visitors from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-11', 'channel', 8)$$,
  $$values ('direct', 2::bigint), ('email', 1::bigint), ('organic_search', 1::bigint)$$,
  'Aufschlüsselung nach Kanal');

select results_eq(
  $$select key, pageviews from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-11', 'page', 2)$$,
  $$values ('/'::text, 2::bigint), ('/leistungen', 2::bigint)$$,
  'Seiten nach Aufrufen mit Limit');

select is(
  (select key from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-11', 'country', 8) where key = 'ZZ'),
  'ZZ', 'Unbekanntes Land wird als ZZ geführt');
select is(
  (select visitors from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-11', 'source', 8) where key = 'newsletter'),
  1::bigint, 'Quelle bevorzugt utm_source');
select ok(analytics.site_has_data('22222222-0000-4000-8000-000000000002'), 'Website hat Daten');
select throws_ok(
  $$select * from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-11', 'visitor_hash; drop', 8)$$,
  '22023', null, 'Unbekannte Dimension wird abgelehnt');
select throws_ok(
  $$select * from analytics.site_daily_stats('22222222-0000-4000-8000-000000000002', '2020-01-01', '2026-01-01')$$,
  '22023', null, 'Zu lange Zeiträume werden abgelehnt');
reset role;

-- Fremde Nutzer und anon
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from analytics.site_daily_stats('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-10')$$,
  '42501', null, 'Fremde sehen keine Tageswerte');
select throws_ok($$select * from analytics.site_breakdown('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-10', 'page', 8)$$,
  '42501', null, 'Fremde sehen keine Aufschlüsselung');
select throws_ok($$select analytics.site_has_data('22222222-0000-4000-8000-000000000002')$$, '42501', null, 'Fremde sehen nicht, ob Daten existieren');
reset role;
set local role anon;
select throws_ok($$select * from analytics.site_daily_stats('22222222-0000-4000-8000-000000000002', '2026-06-10', '2026-06-10')$$,
  '42501', null, 'anon hat keinen Zugriff');
reset role;

select * from finish();
rollback;
