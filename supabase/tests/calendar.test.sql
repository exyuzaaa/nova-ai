-- =============================================================================
-- NOVA Kalender – Datenbanktests (Plattform-Phase 2c)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- A: a Owner, d Mitglied, e Mitglied, c Betrachter · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@cal.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@cal.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@cal.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@cal.example', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'e@cal.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug, timezone) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'cal-a', 'Europe/Berlin'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'cal-b', 'Europe/Berlin');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('e1000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'member'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');
insert into core.teams (id, tenant_id, name) values ('7e000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Vertrieb');
insert into core.team_members (tenant_id, team_id, member_id) values
  ('11111111-0000-4000-8000-00000000000a', '7e000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000d');

-- Einrichtung -------------------------------------------------------------------------
select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'calendar'), 'Kalender ist freigeschaltet');
select is((select count(*)::int from calendar.calendars where tenant_id = '11111111-0000-4000-8000-00000000000a' and kind = 'company'), 1,
  'Unternehmenskalender');
select is((select count(*)::int from calendar.calendars where tenant_id = '11111111-0000-4000-8000-00000000000a' and kind = 'personal'), 4,
  'Persönlicher Kalender je Person');
select is((select name from calendar.calendars where team_id = '7e000000-0000-4000-8000-000000000001'), 'Vertrieb', 'Teamkalender');

create temp table cal as
select (select id from calendar.calendars where owner_member_id = 'd1000000-0000-4000-8000-00000000000d') as d_personal,
       (select id from calendar.calendars where owner_member_id = 'c1000000-0000-4000-8000-00000000000c') as c_personal,
       (select id from calendar.calendars where tenant_id = '11111111-0000-4000-8000-00000000000a' and kind = 'company') as company,
       (select id from calendar.calendars where team_id = '7e000000-0000-4000-8000-000000000001') as team;
grant select on cal to authenticated;

-- Persönliche Termine ------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$insert into calendar.events (id, tenant_id, calendar_id, title, starts_at, ends_at, reminder_minutes)
  select 'e5000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', d_personal, 'Zahnarzt',
         now() + interval '10 minutes', now() + interval '70 minutes', 15 from cal$$, 'Termin im eigenen Kalender');
select lives_ok($$insert into calendar.events (id, tenant_id, calendar_id, title, starts_at, ends_at)
  select 'e5000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', d_personal, 'Kundentermin Müller',
         '2027-03-01 10:00+01', '2027-03-01 11:00+01' from cal$$, 'Zweiter Termin');
insert into calendar.attendees (tenant_id, event_id, member_id) values
  ('11111111-0000-4000-8000-00000000000a', 'e5000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-00000000000e');
select throws_ok($$insert into calendar.events (tenant_id, calendar_id, title, starts_at, ends_at)
  select '11111111-0000-4000-8000-00000000000a', company, 'Betriebsfeier', now(), now() + interval '1 hour' from cal$$,
  '42501', null, 'Unternehmenskalender nur mit calendar.manage');
select pg_temp.logout();
select is((select count(*)::int from core.notifications where kind = 'calendar.invited' and user_id = 'e0000000-0000-0000-0000-00000000000e'), 1,
  'Eingeladene Person wird benachrichtigt');
select is((select count(*)::int from core.audit_logs where action like 'calendar.events.%' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 0,
  'Persönliche Termine stehen nicht im Protokoll');
select is((select count(*)::int from core.search_index where entity_type = 'event' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 0, 'und nicht in der Suche');

select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select is((select array_agg(title order by title) from calendar.events), array['Kundentermin Müller'],
  'Eingeladene sehen nur ihre Einladung, nicht den restlichen Kalender');
select is((select count(*)::int from calendar.agenda('11111111-0000-4000-8000-00000000000a', '2027-03-01', '2027-03-02')), 1,
  'Einladung erscheint in der Agenda');
update calendar.events set title = 'Gekapert' where id = 'e5000000-0000-4000-8000-000000000002';
select lives_ok($$select calendar.respond('e5000000-0000-4000-8000-000000000002', 'accepted')$$, 'Zusagen');
select throws_ok($$select calendar.respond('e5000000-0000-4000-8000-000000000001', 'accepted')$$, 'P0002', null,
  'Ohne Einladung keine Antwort');
select is((select count(*)::int from calendar.busy('11111111-0000-4000-8000-00000000000a',
  array['d1000000-0000-4000-8000-00000000000d']::uuid[], '2027-03-01', '2027-03-02')), 1, 'Frei/Belegt zeigt den Termin von d');
select pg_temp.logout();
select is((select title from calendar.events where id = 'e5000000-0000-4000-8000-000000000002'), 'Kundentermin Müller',
  'Eingeladene ändern den Termin nicht');
select is((select count(*)::int from core.notifications where kind = 'calendar.response' and user_id = 'd0000000-0000-0000-0000-00000000000d'), 1,
  'Organisatorin erfährt die Zusage');

-- Zeitänderung → Eingeladene informieren
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update calendar.events set starts_at = '2027-03-01 11:00+01', ends_at = '2027-03-01 12:00+01' where id = 'e5000000-0000-4000-8000-000000000002';
select pg_temp.logout();
select is((select count(*)::int from core.notifications where kind = 'calendar.updated' and user_id = 'e0000000-0000-0000-0000-00000000000e'), 1,
  'Eingeladene erfahren von Verschiebungen');

-- Betrachter ---------------------------------------------------------------------------
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from calendar.events), 0, 'Betrachter sieht keine fremden persönlichen Termine');
select throws_ok($$insert into calendar.events (tenant_id, calendar_id, title, starts_at, ends_at)
  select '11111111-0000-4000-8000-00000000000a', c_personal, 'X', now(), now() + interval '1 hour' from cal$$, '42501', null,
  'Betrachter legt keine Termine an');
select pg_temp.logout();

-- Team- und Unternehmenskalender ----------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$insert into calendar.events (tenant_id, calendar_id, title, starts_at, ends_at)
  select '11111111-0000-4000-8000-00000000000a', team, 'Vertriebsrunde', '2027-03-02 09:00+01', '2027-03-02 10:00+01' from cal$$,
  'Teammitglied pflegt den Teamkalender');
select pg_temp.logout();
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from calendar.events where title = 'Vertriebsrunde'), 0, 'Andere Teams sehen den Teamkalender nicht');
select pg_temp.logout();
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$insert into calendar.events (tenant_id, calendar_id, title, starts_at, ends_at)
  select '11111111-0000-4000-8000-00000000000a', company, 'Betriebsfeier', '2027-03-05 18:00+01', '2027-03-05 23:00+01' from cal$$,
  'Owner pflegt den Unternehmenskalender');
select is((select count(*)::int from calendar.events where title = 'Vertriebsrunde'), 1, 'calendar.manage sieht Teamkalender');
select pg_temp.logout();
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from calendar.events where title = 'Betriebsfeier'), 1, 'Alle sehen den Unternehmenskalender');
select pg_temp.logout();
select is((select count(*)::int from core.search_index where entity_type = 'event' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 1, 'Unternehmenstermine stehen in der Suche');
select is((select count(*)::int from core.audit_logs where action = 'calendar.events.insert' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 2,
  'Team- und Unternehmenstermine stehen im Protokoll');

-- Wiederholungen (Zeitzone Europe/Berlin, Zeitumstellung am 28.03.2027) ---------------------
create temp table rep (id uuid);
insert into calendar.events (id, tenant_id, calendar_id, title, starts_at, ends_at, repeat_freq, repeat_weekdays, repeat_count, exception_dates)
select 'e5000000-0000-4000-8000-000000000010', '11111111-0000-4000-8000-00000000000a', d_personal, 'Jour fixe',
       '2027-03-22 10:00+01', '2027-03-22 10:30+01', 'weekly', '{3,1}', 5, '{2027-03-29}' from cal;
select results_eq($$select to_char(occurrence_start at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI')
  from calendar.occurrences((select e from calendar.events e where id = 'e5000000-0000-4000-8000-000000000010'),
                            '2027-03-01', '2027-05-01', 'Europe/Berlin')$$,
  $$values ('2027-03-22 10:00'), ('2027-03-24 10:00'), ('2027-03-31 10:00'), ('2027-04-05 10:00')$$,
  'Wöchentlich Mo+Mi, 5 Termine, eine Ausnahme, Uhrzeit bleibt über die Zeitumstellung');
select is((select repeat_weekdays from calendar.events where id = 'e5000000-0000-4000-8000-000000000010'), '{1,3}'::smallint[],
  'Wochentage werden sortiert');

insert into calendar.events (id, tenant_id, calendar_id, title, starts_at, ends_at, repeat_freq, repeat_until)
select 'e5000000-0000-4000-8000-000000000011', '11111111-0000-4000-8000-00000000000a', d_personal, 'Monatsabschluss',
       '2027-01-31 15:00+01', '2027-01-31 16:00+01', 'monthly', '2027-06-30' from cal;
select results_eq($$select to_char(occurrence_start at time zone 'Europe/Berlin', 'MM-DD')
  from calendar.occurrences((select e from calendar.events e where id = 'e5000000-0000-4000-8000-000000000011'),
                            '2027-01-01', '2028-01-01', 'Europe/Berlin')$$,
  $$values ('01-31'), ('03-31'), ('05-31')$$, 'Monatlich am 31.: Monate ohne 31. entfallen, Ende am 30.06.');

insert into calendar.events (id, tenant_id, calendar_id, title, starts_at, ends_at, all_day, repeat_freq, repeat_interval)
select 'e5000000-0000-4000-8000-000000000012', '11111111-0000-4000-8000-00000000000a', d_personal, 'Alle zwei Tage',
       '2027-03-27 00:00+01', '2027-03-28 00:00+01', true, 'daily', 2 from cal;
select is((select count(*)::int from calendar.occurrences((select e from calendar.events e where id = 'e5000000-0000-4000-8000-000000000012'),
  '2027-03-27 00:00+01', '2027-04-06 00:00+02', 'Europe/Berlin')), 5, 'Täglich mit Intervall');

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$select calendar.skip_occurrence('e5000000-0000-4000-8000-000000000011', '2027-03-31')$$, 'Einzelnen Termin streichen');
select pg_temp.logout();
select is((select exception_dates from calendar.events where id = 'e5000000-0000-4000-8000-000000000011'), '{2027-03-31}'::date[],
  'Ausnahme gespeichert');

-- Erinnerungen ------------------------------------------------------------------------------
select is(calendar.send_reminders(), 1, 'Erinnerung für den Termin in 10 Minuten');
select is(calendar.send_reminders(), 0, 'nur einmal');
select is((select count(*)::int from core.notifications where kind = 'calendar.reminder' and user_id = 'd0000000-0000-0000-0000-00000000000d'), 1,
  'an die Kalenderinhaberin');

-- Abo-Link ------------------------------------------------------------------------------------
create temp table feed (token text);
grant all on feed to authenticated, anon;
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
insert into feed select calendar.create_feed_token('11111111-0000-4000-8000-00000000000a');
select ok(calendar.has_feed_token('11111111-0000-4000-8000-00000000000a'), 'Abo-Link angelegt');
select pg_temp.logout();
select matches((select token from feed), '^[0-9a-f]{48}$', 'Token hat 48 Hexzeichen');
select is((select count(*)::int from calendar.feed_tokens where token_hash = (select token from feed)), 0, 'Gespeichert wird nur der Hash');

select pg_temp.anon();
select is((select array_agg(title order by title) from calendar.feed_events((select token from feed))),
  array['Betriebsfeier', 'Kundentermin Müller'], 'Abo enthält Unternehmenstermine und Zusagen, keine fremden Termine');
select is((select count(*)::int from calendar.feed_events(repeat('0', 48))), 0, 'Falscher Token liefert nichts');
select throws_ok($$select * from calendar.events$$, '42501', null, 'Gäste lesen keine Tabellen');
select pg_temp.logout();

select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select calendar.revoke_feed_token('11111111-0000-4000-8000-00000000000a');
select pg_temp.logout();
select is((select count(*)::int from calendar.feed_events((select token from feed))), 0, 'Widerrufener Link liefert nichts');

-- Fremdes Unternehmen ---------------------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from calendar.events), 0, 'Fremde Termine unsichtbar');
select is((select count(*)::int from calendar.busy('11111111-0000-4000-8000-00000000000a',
  array['d1000000-0000-4000-8000-00000000000d']::uuid[], '2027-03-01', '2027-03-02')), 0, 'Kein Frei/Belegt fremder Personen');
select throws_ok($$insert into calendar.events (tenant_id, calendar_id, title, starts_at, ends_at)
  select '11111111-0000-4000-8000-00000000000a', d_personal, 'Fremd', now(), now() + interval '1 hour' from cal$$, '42501', null,
  'Keine Termine in fremden Kalendern');
select pg_temp.logout();

-- Neue Mitglieder und Teams bekommen Kalender automatisch
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('b2000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'e0000000-0000-0000-0000-00000000000e', 'member');
select is((select count(*)::int from calendar.calendars where owner_member_id = 'b2000000-0000-4000-8000-00000000000b'), 1,
  'Neues Mitglied erhält einen persönlichen Kalender');

select * from finish();
rollback;
