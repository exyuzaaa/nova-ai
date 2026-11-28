-- =============================================================================
-- NOVA Personal (HR) – Datenbanktests (Plattform-Phase 2d)
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
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- A: a Owner, d Mitglied (Führungskraft von e), e Mitglied, c Betrachter · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@hr.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@hr.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@hr.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@hr.example', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'e@hr.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'hr-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'hr-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('e1000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'member'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'hr'), 'Personal ist freigeschaltet');
select is((select count(*)::int from hr.absence_types where tenant_id = '11111111-0000-4000-8000-00000000000a'), 5, 'Fünf Abwesenheitsarten');

-- Mitarbeiter -------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
insert into hr.employees (id, tenant_id, member_id, first_name, last_name, position, personnel_number) values
  ('ee000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-00000000000a', 'Anna', 'Admin', 'Geschäftsführung', 'X');
insert into hr.employees (id, tenant_id, member_id, first_name, last_name, position, manager_employee_id) values
  ('ee000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-00000000000d', 'Dora', 'Dienst', 'Teamleitung', 'ee000000-0000-4000-8000-00000000000a'),
  ('ee000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e1000000-0000-4000-8000-00000000000e', 'Emil', 'Eifrig', 'Sachbearbeitung', 'ee000000-0000-4000-8000-00000000000d');
insert into hr.employees (id, tenant_id, first_name, last_name, entry_date, vacation_days) values
  ('ee000000-0000-4000-8000-0000000000f1', '11111111-0000-4000-8000-00000000000a', 'Neu', 'Zugang', '2027-07-01', 30);
select is((select array_agg(personnel_number order by personnel_number) from hr.employees), array['MA-00001', 'MA-00002', 'MA-00003', 'MA-00004'],
  'Personalnummern werden vergeben');
select throws_ok($$update hr.employees set manager_employee_id = 'ee000000-0000-4000-8000-00000000000e' where id = 'ee000000-0000-4000-8000-00000000000a'$$,
  '23514', null, 'Kein Kreis in der Vorgesetztenkette');
insert into hr.employee_private (employee_id, tenant_id, salary_amount, salary_period, iban) values
  ('ee000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 3800, 'month', 'DE89370400440532013000');
update hr.employee_private set salary_amount = 3900 where employee_id = 'ee000000-0000-4000-8000-00000000000e';
insert into hr.public_holidays (tenant_id, date, name) values ('11111111-0000-4000-8000-00000000000a', '2027-03-26', 'Karfreitag');
select pg_temp.logout();

select is((select metadata from core.audit_logs where action = 'hr.employee_private.update'), '{"number": "MA-00003"}'::jsonb,
  'Protokoll nennt keine vertraulichen Werte');
select is((select count(*)::int from core.search_index where entity_type = 'employee' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 4,
  'Mitarbeiter stehen in der Suche');

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from hr.employees), 4, 'Verzeichnis sichtbar');
select is((select count(*)::int from hr.employee_private), 0, 'Vertrauliche Daten unsichtbar ohne hr.sensitive');
select throws_ok($$insert into hr.employees (tenant_id, first_name, last_name) values ('11111111-0000-4000-8000-00000000000a', 'X', 'Y')$$,
  '42501', null, 'Mitglieder legen keine Mitarbeiter an');
select pg_temp.logout();

-- Urlaubsantrag -------------------------------------------------------------------------
create temp table ids (vacation uuid, sick uuid, special uuid, half uuid);
insert into ids values (
  (select id from hr.absence_types where tenant_id = '11111111-0000-4000-8000-00000000000a' and name = 'Urlaub'),
  (select id from hr.absence_types where tenant_id = '11111111-0000-4000-8000-00000000000a' and name = 'Krankheit'),
  (select id from hr.absence_types where tenant_id = '11111111-0000-4000-8000-00000000000a' and name = 'Sonderurlaub'), null);
grant all on ids to authenticated;

select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
create temp table req as select hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select vacation from ids), '2027-03-01', '2027-03-07', false, false, 'Skiurlaub') as id;
select is((select days from hr.absences where id = (select id from req)), 5.0, 'Fünf Arbeitstage (Wochenende zählt nicht)');
select is((select status from hr.absences where id = (select id from req)), 'requested', 'Antrag ist offen');
select throws_ok($$select hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select vacation from ids), '2027-03-05', '2027-03-09')$$,
  '23P01', null, 'Keine überlappenden Abwesenheiten');
select throws_ok($$select hr.request_absence('ee000000-0000-4000-8000-00000000000d', (select vacation from ids), '2027-05-03', '2027-05-04')$$,
  '42501', null, 'Keine Anträge für andere');
select throws_ok($$select hr.decide_absence((select id from req), true)$$, '42501', null, 'Eigene Anträge nicht selbst genehmigen');
update ids set half = hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select vacation from ids), '2027-03-10', '2027-03-10', true, false, null);
select is((select days from hr.absences where id = (select half from ids)), 0.5, 'Halber Tag');
create temp table holiday as select hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select vacation from ids), '2027-03-22', '2027-03-26') as id;
select is((select days from hr.absences where id = (select id from holiday)), 4.0, 'Feiertage zählen nicht');
select pg_temp.logout();
select is((select count(*)::int from core.notifications where kind = 'hr.absence.requested' and user_id = 'd0000000-0000-0000-0000-00000000000d'), 3,
  'Führungskraft wird über Anträge informiert');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok($$select hr.decide_absence((select id from req), true)$$, 'P0002', null, 'Andere sehen fremde Anträge nicht');
select is((select count(*)::int from hr.absences), 0, 'Betrachter sieht keine Abwesenheitsdetails');
select pg_temp.logout();

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$select hr.decide_absence((select id from req), true, 'Viel Spaß')$$, 'Führungskraft genehmigt');
select throws_ok($$select hr.decide_absence((select id from req), false)$$, '22023', null, 'Nur einmal entscheiden');
select lives_ok($$select hr.decide_absence((select half from ids), false, 'Termin mit Kunde')$$, 'Führungskraft lehnt ab');
select pg_temp.logout();
select is((select count(*)::int from core.notifications where kind = 'hr.absence.decided' and user_id = 'e0000000-0000-0000-0000-00000000000e'), 2,
  'Antragsteller erfährt die Entscheidung');

-- Krankmeldung: ohne Genehmigung, Art nur für Berechtigte sichtbar
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select sick from ids), '2027-04-12', '2027-04-13');
select is((select status from hr.absences where type_id = (select sick from ids)), 'approved', 'Krankmeldung gilt sofort');
select is((select remaining from hr.vacation_balance('ee000000-0000-4000-8000-00000000000e', 2027)), 21.0,
  'Resturlaub: 30 − 5 genommen − 4 geplant');
select pg_temp.logout();

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select array_agg(label order by start_date) from hr.absence_overview('11111111-0000-4000-8000-00000000000a', '2027-03-01', '2027-05-01')),
  array['Abwesend', 'Abwesend'], 'Andere sehen nur „Abwesend“ und nur Genehmigtes');
select is((select count(*)::int from hr.vacation_balance('ee000000-0000-4000-8000-00000000000e', 2027)), 0, 'und kein fremdes Urlaubskonto');
select pg_temp.logout();
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select is((select array_agg(label order by start_date) from hr.absence_overview('11111111-0000-4000-8000-00000000000a', '2027-03-01', '2027-05-01')),
  array['Urlaub', 'Urlaub', 'Krankheit'], 'Führungskraft sieht Art und offene Anträge');
select pg_temp.logout();

-- Zurückziehen
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$select hr.cancel_absence((select id from req))$$, 'Künftigen genehmigten Urlaub zurückziehen');
select is((select taken from hr.vacation_balance('ee000000-0000-4000-8000-00000000000e', 2027)), 0.0, 'Urlaub wieder gutgeschrieben');
select pg_temp.logout();

-- Anteiliger Anspruch im Eintrittsjahr, Korrekturen
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select entitlement from hr.vacation_balance('ee000000-0000-4000-8000-0000000000f1', 2027)), 15.0, 'Eintritt 1. Juli: halber Anspruch');
insert into hr.vacation_adjustments (tenant_id, employee_id, year, days, reason) values
  ('11111111-0000-4000-8000-00000000000a', 'ee000000-0000-4000-8000-0000000000f1', 2027, 2.5, 'Übertrag aus Vorjahr');
select is((select remaining from hr.vacation_balance('ee000000-0000-4000-8000-0000000000f1', 2027)), 17.5, 'Korrektur zählt mit');
select is((select count(*)::int from hr.employee_private), 1, 'Owner sieht vertrauliche Daten');
select pg_temp.logout();

-- Fremdes Unternehmen --------------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from hr.employees), 0, 'Fremde Mitarbeiter unsichtbar');
select is((select count(*)::int from hr.employee_private), 0, 'Fremde vertrauliche Daten unsichtbar');
select is((select count(*)::int from hr.absence_overview('11111111-0000-4000-8000-00000000000a', '2027-01-01', '2027-12-31')), 0,
  'Keine fremde Abwesenheitsübersicht');
select throws_ok($$select hr.request_absence('ee000000-0000-4000-8000-00000000000e', (select vacation from ids), '2027-06-01', '2027-06-02')$$,
  'P0002', null, 'Keine Anträge in fremden Unternehmen');
select pg_temp.logout();

select * from finish();
rollback;
