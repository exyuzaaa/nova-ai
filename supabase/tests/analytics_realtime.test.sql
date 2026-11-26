-- =============================================================================
-- NOVA ANALYTICS – Datenbanktests: Heartbeat, Echtzeit, Verteilungen (Phase 6)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'fremd@example.com', now(), 'authenticated', 'authenticated');
insert into analytics.organizations (id, name, slug) values ('11111111-0000-4000-8000-000000000001', 'Org', 'org-realtime');
insert into analytics.organization_members (organization_id, user_id, role)
  values ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'viewer');
insert into analytics.websites (id, organization_id, name, domain, public_site_id)
  values ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Site', 'live.example', 'ns_00000000000000aa');

create function pg_temp.event(extra jsonb) returns jsonb language sql as $$
  select jsonb_build_object('site_id', 'ns_00000000000000aa', 'type', 'pageview', 'hostname', 'live.example',
                            'pathname', '/', 'ip', '203.0.113.7', 'user_agent', 'Mozilla/5.0 Test',
                            'channel', 'organic_search', 'country_code', 'DE', 'device_type', 'mobile') || extra;
$$;

set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{"type":"heartbeat"}')), 'ignored', 'Heartbeat ohne Session wird ignoriert');
select is(public.nova_ingest_event(pg_temp.event('{}')), 'ok', 'Seitenaufruf');
select is(public.nova_ingest_event(pg_temp.event('{"pathname":"/preise"}')), 'ok', 'Zweiter Seitenaufruf');
select is(public.nova_ingest_event(pg_temp.event('{"type":"custom","name":"newsletter_signup"}')), 'ok', 'Eigenes Event');
reset role;

-- Session „altern“ lassen, dann Heartbeat
update analytics.analytics_sessions set last_activity_at = now() - interval '5 minutes'
where website_id = '22222222-0000-4000-8000-000000000002';
select is((select count(*)::int from analytics.analytics_events where website_id = '22222222-0000-4000-8000-000000000002'), 3, 'Drei Events vor dem Heartbeat');
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{"type":"heartbeat"}')), 'ok', 'Heartbeat zu laufender Session');
reset role;
select is((select count(*)::int from analytics.analytics_events where website_id = '22222222-0000-4000-8000-000000000002'), 3, 'Heartbeat erzeugt kein Event');
select ok((select last_activity_at > now() - interval '5 seconds' from analytics.analytics_sessions
           where website_id = '22222222-0000-4000-8000-000000000002'), 'Heartbeat verlängert die Session');

-- Echtzeit als Viewer
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') ->> 'active_now')::int, 1, 'Ein Besucher gerade aktiv');
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') ->> 'pageviews_30m')::int, 2, 'Zwei Seitenaufrufe in 30 Minuten');
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') ->> 'events_30m')::int, 1, 'Ein eigenes Event in 30 Minuten');
select is(jsonb_array_length(analytics.site_realtime('22222222-0000-4000-8000-000000000002') -> 'pageviews_per_minute'), 30, '30 Minutenwerte');
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') -> 'pageviews_per_minute' ->> 29)::int, 2, 'Aktuelle Minute steht am Ende');
select is(analytics.site_realtime('22222222-0000-4000-8000-000000000002') -> 'pages' -> 0 ->> 'key', '/preise', 'Aktuelle Seite ist die zuletzt aufgerufene');
select is(analytics.site_realtime('22222222-0000-4000-8000-000000000002') -> 'recent_events' -> 0 ->> 'name', 'newsletter_signup', 'Letzte Events');
select is(analytics.site_realtime('22222222-0000-4000-8000-000000000002') -> 'devices' -> 0 ->> 'key', 'mobile', 'Geräte der aktiven Besucher');

select results_eq(
  $$select bucket, sessions from analytics.site_session_distribution('22222222-0000-4000-8000-000000000002', current_date - 1, current_date + 1) where kind = 'depth'$$,
  $$values ('1'::text, 0::bigint), ('2', 1::bigint), ('3_4', 0::bigint), ('5_9', 0::bigint), ('10p', 0::bigint)$$,
  'Seitentiefe: eine Session mit zwei Seiten');
select is((select count(*)::int from analytics.site_session_distribution('22222222-0000-4000-8000-000000000002', current_date - 1, current_date + 1) where kind = 'duration'),
  6, 'Sechs Dauer-Klassen, auch leere');
reset role;

-- Inaktiv: nach 90 Sekunden nicht mehr „gerade aktiv“
update analytics.analytics_sessions set last_activity_at = now() - interval '2 minutes'
where website_id = '22222222-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') ->> 'active_now')::int, 0, 'Nach 2 Minuten ohne Signal nicht mehr aktiv');
select is((analytics.site_realtime('22222222-0000-4000-8000-000000000002') ->> 'active_30m')::int, 1, 'Aber in den letzten 30 Minuten');
reset role;

-- Zugriffsschutz
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select analytics.site_realtime('22222222-0000-4000-8000-000000000002')$$, '42501', null, 'Fremde sehen keine Echtzeitdaten');
select throws_ok($$select * from analytics.site_session_distribution('22222222-0000-4000-8000-000000000002', current_date, current_date)$$,
  '42501', null, 'Fremde sehen keine Verteilung');
reset role;
set local role anon;
select throws_ok($$select analytics.site_realtime('22222222-0000-4000-8000-000000000002')$$, '42501', null, 'anon hat keinen Zugriff');
reset role;

select * from finish();
rollback;
