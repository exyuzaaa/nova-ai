-- =============================================================================
-- NOVA ANALYTICS – Datenbanktests: Event-Erfassung (nova_ingest_event)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Testdaten: Organisation + Website (als postgres angelegt)
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@example.com', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'fremd@example.com', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values ('11111111-0000-4000-8000-000000000001', 'Org', 'org');
insert into core.tenant_members (tenant_id, user_id, role)
  values ('11111111-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'owner');
insert into analytics.websites (id, organization_id, name, domain, public_site_id, additional_domains)
  values ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Site', 'beispiel.de',
          'ns_0123456789abcdef', '{shop.example.org}');

create function pg_temp.event(extra jsonb) returns jsonb language sql as $$
  select jsonb_build_object('site_id', 'ns_0123456789abcdef', 'type', 'pageview', 'hostname', 'www.beispiel.de',
                            'pathname', '/', 'ip', '203.0.113.7', 'user_agent', 'Mozilla/5.0 Test') || extra;
$$;

-- Aufruf wie der Collect-Endpunkt: Rolle anon
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{}')), 'ok', 'Seitenaufruf wird angenommen');
select is(public.nova_ingest_event(pg_temp.event('{"pathname":"/preise"}')), 'ok', 'Zweiter Seitenaufruf');
select is(public.nova_ingest_event(pg_temp.event('{"type":"custom","name":"contact_form_submitted","props":{"form":"kontakt"}}')), 'ok', 'Custom Event');
select is(public.nova_ingest_event(pg_temp.event('{"hostname":"shop.example.org"}')), 'ok', 'Zusatzdomain wird akzeptiert');
select is(public.nova_ingest_event(pg_temp.event('{"hostname":"blog.beispiel.de"}')), 'ok', 'Subdomain wird akzeptiert');
select is(public.nova_ingest_event(pg_temp.event('{"hostname":"boese.example"}')), 'domain_mismatch', 'Fremde Domain wird abgelehnt');
select is(public.nova_ingest_event(pg_temp.event('{"hostname":"xbeispiel.de"}')), 'domain_mismatch', 'Ähnliche Domain wird abgelehnt');
select is(public.nova_ingest_event(pg_temp.event('{"site_id":"ns_ffffffffffffffff"}')), 'unknown_site', 'Unbekannte Website wird abgelehnt');
select is(public.nova_ingest_event(pg_temp.event('{"type":"drop table"}')), 'invalid', 'Unbekannter Eventtyp wird abgelehnt');
select is(public.nova_ingest_event(pg_temp.event('{"gpc":true}')), 'ignored', 'Global Privacy Control wird respektiert');
select is(public.nova_ingest_event(pg_temp.event('{"type":"form_submit"}')), 'ignored', 'Formular-Tracking ist standardmäßig aus');
select is(public.nova_ingest_event(pg_temp.event('{"type":"scroll","scroll_depth":80}')), 'ignored', 'Scrolltiefe ist standardmäßig aus');
select is(public.nova_ingest_event(pg_temp.event('{"type":"engagement","engagement_ms":4000}')), 'ok', 'Engagement wird zur Session addiert');
select throws_ok('select count(*) from analytics.analytics_events', '42501', null, 'anon kann keine Events lesen');
select throws_ok('select count(*) from analytics.daily_salts', '42501', null, 'anon kann keine Salts lesen');
reset role;

-- Ergebnis prüfen (als postgres)
select is((select count(*)::int from analytics.analytics_events where website_id = '22222222-0000-4000-8000-000000000002'), 6, 'Sechs Events gespeichert');
select is((select count(*)::int from analytics.analytics_sessions where website_id = '22222222-0000-4000-8000-000000000002'), 1, 'Alle Events desselben Besuchers in einer Session');
select is((select pageviews from analytics.analytics_sessions where website_id = '22222222-0000-4000-8000-000000000002'), 4, 'Session zählt vier Seitenaufrufe');
select is((select engagement_ms from analytics.analytics_sessions where website_id = '22222222-0000-4000-8000-000000000002'), 4000::bigint, 'Engagement-Zeit summiert');
select is((select hostname from analytics.analytics_events where website_id = '22222222-0000-4000-8000-000000000002' order by received_at limit 1), 'beispiel.de', 'www wird entfernt');
select is((select count(*)::int from analytics.custom_events where event_name = 'contact_form_submitted'), 1, 'Custom-Event-Name registriert');
select ok(not exists (select 1 from analytics.analytics_events where props::text like '%203.0.113.7%' or visitor_hash::text like '%203%'),
  'IP-Adresse wird nirgends gespeichert');
select is((select count(*)::int from analytics.daily_salts where day = current_date), 1, 'Ein Tages-Salt für heute existiert');

-- Anderer Besucher → eigene Session; Kampagnenwechsel → neue Session
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{"ip":"198.51.100.1"}')), 'ok', 'Anderer Besucher');
select is(public.nova_ingest_event(pg_temp.event('{"utm_source":"newsletter","utm_campaign":"herbst"}')), 'ok', 'Kampagnenbesuch');
reset role;
select is((select count(*)::int from analytics.analytics_sessions where website_id = '22222222-0000-4000-8000-000000000002'), 3, 'Neuer Besucher und Kampagnenwechsel erzeugen neue Sessions');

-- Session-Timeout: alte Session nicht fortsetzen
update analytics.analytics_sessions set last_activity_at = now() - interval '31 minutes' where website_id = '22222222-0000-4000-8000-000000000002';
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{}')), 'ok', 'Besuch nach Pause');
reset role;
select is((select count(*)::int from analytics.analytics_sessions where website_id = '22222222-0000-4000-8000-000000000002'), 4, 'Nach 30 Minuten Inaktivität beginnt eine neue Session');

-- Pausierte Website und Einwilligungsmodus
update analytics.tracking_settings set tracking_mode = 'consent_required' where website_id = '22222222-0000-4000-8000-000000000002';
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{}')), 'ignored', 'Ohne Einwilligung wird im Modus consent_required nichts erfasst');
select is(public.nova_ingest_event(pg_temp.event('{"consent":true}')), 'ok', 'Mit Einwilligung wird erfasst');
reset role;
update analytics.websites set status = 'paused' where id = '22222222-0000-4000-8000-000000000002';
set local role anon;
select is(public.nova_ingest_event(pg_temp.event('{"consent":true}')), 'unknown_site', 'Pausierte Website nimmt nichts an');
reset role;

-- Installationsstatus: nur mit Zugriff
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select ok((select pageviews_24h from analytics.tracking_status('22222222-0000-4000-8000-000000000002')) >= 4, 'Owner sieht den Installationsstatus');
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from analytics.tracking_status('22222222-0000-4000-8000-000000000002')$$, '42501', null, 'Fremde sehen den Status nicht');
select throws_ok($$select public.nova_ingest_event('{}')$$, '42501', null, 'Angemeldete Nutzer schreiben nicht direkt Events');
reset role;

-- Salts werden nach zwei Tagen gelöscht
insert into analytics.daily_salts (day, salt) values (current_date - 3, '\x00');
select lives_ok('select analytics.purge_daily_salts()', 'Bereinigung läuft');
select is((select count(*)::int from analytics.daily_salts where day < current_date - 1), 0, 'Alte Salts werden gelöscht');

select * from finish();
rollback;
