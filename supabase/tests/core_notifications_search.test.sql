-- =============================================================================
-- NOVA CORE – Datenbanktests: Benachrichtigungen und globale Suche (Phase 1d)
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

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner@suche.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'fremd@suche.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'viewer@suche.example', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'admin@suche.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'suche-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'suche-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('e1000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'admin'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

-- Benachrichtigungen aus echten Ereignissen ------------------------------------------
-- Neues Mitglied → Owner und Admin werden informiert, das neue Mitglied selbst nicht
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer');
select is((select count(*)::int from core.notifications where kind = 'core.member.joined'
           and tenant_id = '11111111-0000-4000-8000-00000000000a' and title like 'viewer@suche.example%'), 2,
  'Beitritt: Owner und Admin werden benachrichtigt');
select is((select count(*)::int from core.notifications where user_id = 'c0000000-0000-0000-0000-00000000000c'), 0,
  'Das neue Mitglied erhält keine Beitrittsmeldung über sich selbst');

-- Rollenänderung durch den Owner → betroffene Person
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
update core.tenant_members set role = 'member' where id = 'c1000000-0000-4000-8000-00000000000c';
select pg_temp.logout();
select is((select title from core.notifications where user_id = 'c0000000-0000-0000-0000-00000000000c' and kind = 'core.member.role_changed'),
  'Deine Rolle wurde geändert: Mitglied', 'Rollenänderung wird der Person gemeldet');

-- Teamzuordnung
insert into core.teams (id, tenant_id, name) values ('55555555-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Vertrieb Nord');
insert into core.team_members (tenant_id, team_id, member_id) values
  ('11111111-0000-4000-8000-00000000000a', '55555555-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-00000000000c');
select ok(exists (select 1 from core.notifications where user_id = 'c0000000-0000-0000-0000-00000000000c' and kind = 'core.team.joined'
  and title like '%Vertrieb Nord%'), 'Teamzuordnung wird gemeldet');

-- Abbestellen wirkt
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
insert into core.notification_preferences (user_id, kind, in_app) values ('e0000000-0000-0000-0000-00000000000e', 'core.module.changed', false);
select throws_ok($$insert into core.notification_preferences (user_id, kind, in_app) values ('a0000000-0000-0000-0000-00000000000a', 'core.module.changed', false)$$,
  '42501', null, 'Niemand ändert Einstellungen anderer');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', false);
select pg_temp.logout();
select is((select count(*)::int from core.notifications where kind = 'core.module.changed' and user_id = 'e0000000-0000-0000-0000-00000000000e'), 0,
  'Abbestellte Art wird nicht zugestellt');
select is((select count(*)::int from core.notifications where kind = 'core.module.changed' and user_id = 'a0000000-0000-0000-0000-00000000000a'), 0,
  'Die auslösende Person wird nicht über die eigene Änderung informiert');

-- Zugriff: nur eigene, gelesen markieren, keine Fälschung
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from core.notifications), 2, 'C sieht nur die eigenen Benachrichtigungen');
update core.notifications set read_at = now() where kind = 'core.team.joined';
select is((select count(*)::int from core.notifications where read_at is null), 1, 'C markiert als gelesen');
select throws_ok($$insert into core.notifications (tenant_id, user_id, kind, title) values
  ('11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'core.fake.message', 'Gefälscht')$$,
  '42501', null, 'Clients können keine Benachrichtigungen erzeugen');
select throws_ok($$update core.notifications set title = 'geändert'$$, '42501', null, 'Inhalte sind nicht änderbar');
select throws_ok($$select core.notify('11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'core.x.y', 'x')$$,
  '42501', null, 'core.notify ist für Clients gesperrt');
update core.notifications set read_at = now() where user_id = 'a0000000-0000-0000-0000-00000000000a';
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok((select bool_and(read_at is null) from core.notifications), 'Fremde Benachrichtigungen bleiben unberührt');
select pg_temp.logout();

-- Austritt: keine Zustellung mehr an Nicht-Mitglieder
select is((select count(*)::int from (select core.notify('11111111-0000-4000-8000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'core.x.test', 'Test')) x
  cross join lateral (select 1) y), 1, 'notify ausgeführt');
select is((select count(*)::int from core.notifications where user_id = 'b0000000-0000-0000-0000-00000000000b' and tenant_id = '11111111-0000-4000-8000-00000000000a'),
  0, 'Nicht-Mitglieder erhalten keine Benachrichtigungen des Unternehmens');

-- Suche ------------------------------------------------------------------------------
select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', true)
from (select pg_temp.login('a0000000-0000-0000-0000-00000000000a')) x;
select pg_temp.logout();
insert into core.departments (id, tenant_id, name, description) values
  ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Vertriebsinnendienst', 'Angebote und Aufträge');
insert into core.departments (tenant_id, name) values ('11111111-0000-4000-8000-00000000000b', 'Vertrieb B');
insert into analytics.websites (id, organization_id, name, domain) values
  ('22222222-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'Onlineshop', 'shop-vertrieb.example');

select is((select count(*)::int from core.search_index where tenant_id = '11111111-0000-4000-8000-00000000000a' and entity_type = 'member'),
  3, 'Mitglieder werden indexiert');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select set_eq($$select title from core.search('11111111-0000-4000-8000-00000000000a', 'vertrieb')$$,
  array['Vertriebsinnendienst', 'Vertrieb Nord', 'Onlineshop'], 'Präfixsuche über Abteilungen, Teams und Websites');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', 'auftr')), 1, 'Suche im Untertitel');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', 'vertrieb nord')), 1, 'Mehrere Begriffe werden verknüpft');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', '''); drop table x; --')), 0,
  'Sonderzeichen sind harmlos');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', '   ')), 0, 'Leere Suche liefert nichts');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000b', 'vertrieb')), 0, 'Suche in fremdem Unternehmen liefert nichts');
select pg_temp.logout();

-- Rechte wirken auf Treffer: Analytics ausgeschaltet → keine Website-Treffer
update core.tenant_modules set enabled = false where tenant_id = '11111111-0000-4000-8000-00000000000a' and module_key = 'analytics';
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', 'onlineshop')), 0,
  'Treffer aus abgeschalteten Modulen erscheinen nicht');
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from core.search_index), 2, 'B sieht nur eigene Einträge (Abteilung und eigenes Mitglied)');
select pg_temp.logout();

-- Pflege des Index
update core.departments set name = 'Innendienst' where id = '44444444-0000-4000-8000-000000000001';
select is((select title from core.search_index where entity_id = '44444444-0000-4000-8000-000000000001'), 'Innendienst', 'Umbenennen aktualisiert den Index');
delete from core.departments where id = '44444444-0000-4000-8000-000000000001';
select is((select count(*)::int from core.search_index where entity_id = '44444444-0000-4000-8000-000000000001'), 0, 'Löschen entfernt den Eintrag');
update analytics.websites set deleted_at = now() where id = '22222222-0000-4000-8000-00000000000a';
select is((select count(*)::int from core.search_index where entity_type = 'website' and entity_id = '22222222-0000-4000-8000-00000000000a'), 0,
  'Gelöschte Websites verschwinden aus der Suche');

select * from finish();
rollback;
