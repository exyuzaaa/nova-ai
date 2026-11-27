-- =============================================================================
-- NOVA CORE – Datenbanktests: Rechte, eigene Rollen, Abteilungen, Teams, Module
-- (Plattform-Phase 1b)
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

-- A: a Owner, c Viewer, d Mitglied, e Admin · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@perm.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@perm.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@perm.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@perm.example', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'e@perm.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'perm-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'perm-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('e1000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'admin'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');
insert into analytics.websites (id, organization_id, name, domain, public_site_id) values
  ('22222222-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'Site A', 'perm.example', 'ns_00000000000000bb');

-- Module ------------------------------------------------------------------------
select is((select enabled from core.tenant_modules where tenant_id = '11111111-0000-4000-8000-00000000000a' and module_key = 'analytics'),
  true, 'Neue Unternehmen erhalten Analytics automatisch');
select is((select count(*)::int from core.tenant_modules where tenant_id = '11111111-0000-4000-8000-00000000000a' and module_key = 'crm'),
  0, 'Geplante Module werden nicht automatisch freigeschaltet');
select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'core'), 'Kern ist immer freigeschaltet');
select ok(not core.module_enabled('11111111-0000-4000-8000-00000000000a', 'crm'), 'CRM ist (noch) nicht freigeschaltet');

-- Basisrollen -------------------------------------------------------------------
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.members.read'), 'Viewer sieht Mitglieder');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'analytics.view'), 'Viewer sieht Analytics');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'analytics.edit'), 'Viewer bearbeitet Analytics nicht');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'core.departments.manage'), 'Viewer verwaltet keine Abteilungen');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'gibt.es.nicht'), 'Unbekanntes Recht ist nie erteilt');
select ok(not core.can('11111111-0000-4000-8000-00000000000b', 'core.members.read'), 'Viewer A hat in B keine Rechte');
select is((select array_agg(k) from core.my_permissions('11111111-0000-4000-8000-00000000000a') k),
  array['analytics.view', 'core.departments.read', 'core.members.read'], 'Rechte des Viewers');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'analytics.edit'), 'Mitglied bearbeitet Analytics');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'core.audit.read'), 'Mitglied sieht kein Protokoll');
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.roles.manage'), 'Admin verwaltet Rollen');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'core.billing.manage'), 'Admin verwaltet kein Abonnement');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.billing.manage'), 'Owner verwaltet das Abonnement');

-- Eigene Rollen und Schutz vor Rechteausweitung ------------------------------------
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$insert into core.roles (id, tenant_id, name) values
  ('33333333-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Teamleitung')$$, 'Admin legt Rolle an');
select throws_ok($$insert into core.roles (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'teamleitung')$$,
  '23505', null, 'Rollennamen sind je Unternehmen eindeutig (ohne Groß-/Kleinschreibung)');
select lives_ok($$insert into core.role_permissions (tenant_id, role_id, permission_key) values
  ('11111111-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'core.departments.manage')$$,
  'Admin gibt der Rolle ein vergebbares Recht');
select throws_ok($$insert into core.role_permissions (tenant_id, role_id, permission_key) values
  ('11111111-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'core.members.manage')$$,
  '42501', null, 'Verwaltungsrechte des Kerns sind nicht vergebbar');
select throws_ok($$insert into core.role_permissions (tenant_id, role_id, permission_key) values
  ('11111111-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'core.billing.manage')$$,
  '42501', null, 'Niemand vergibt Rechte, die er selbst nicht hat');
select lives_ok($$insert into core.member_roles (tenant_id, member_id, role_id) values
  ('11111111-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-00000000000c', '33333333-0000-4000-8000-000000000001')$$,
  'Admin vergibt die Rolle an Viewer C');

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$insert into core.member_roles (tenant_id, member_id, role_id) values
  ('11111111-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-00000000000d', '33333333-0000-4000-8000-000000000001')$$,
  '42501', null, 'Mitglied kann sich keine Rolle selbst geben');
select throws_ok($$insert into core.roles (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'Eigene')$$,
  '42501', null, 'Mitglied legt keine Rollen an');

-- Viewer C hat jetzt zusätzlich die Abteilungsverwaltung
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.departments.manage'), 'Eigene Rolle erweitert die Rechte');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'analytics.edit'), 'aber nur um die Rechte der Rolle');
select lives_ok($$insert into core.departments (id, tenant_id, name) values
  ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Vertrieb')$$, 'C legt Abteilung an');
select lives_ok($$insert into core.departments (id, tenant_id, name, parent_id) values
  ('44444444-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', 'Innendienst', '44444444-0000-4000-8000-000000000001')$$,
  'Unterabteilung');
select throws_ok($$update core.departments set parent_id = '44444444-0000-4000-8000-000000000002'
  where id = '44444444-0000-4000-8000-000000000001'$$, '23514', null, 'Keine Zyklen in der Abteilungshierarchie');
select lives_ok($$insert into core.teams (id, tenant_id, name, department_id, lead_member_id) values
  ('55555555-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Team Nord',
   '44444444-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000d')$$, 'Team mit Leitung');
select lives_ok($$insert into core.team_members (tenant_id, team_id, member_id) values
  ('11111111-0000-4000-8000-00000000000a', '55555555-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000d')$$,
  'Mitglied ins Team');
select throws_ok($$insert into core.teams (tenant_id, name, lead_member_id) values
  ('11111111-0000-4000-8000-00000000000a', 'Fremdleitung', 'b1000000-0000-4000-8000-00000000000b')$$,
  '23503', null, 'Teamleitung aus fremdem Unternehmen ist unmöglich');

-- Mandantentrennung --------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from core.roles), 0, 'B sieht keine Rollen von A');
select is((select count(*)::int from core.departments), 0, 'B sieht keine Abteilungen von A');
select is((select count(*)::int from core.teams), 0, 'B sieht keine Teams von A');
select is((select count(*)::int from core.tenant_modules), 1, 'B sieht nur die eigenen Module');
select throws_ok($$insert into core.departments (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'Eingeschleust')$$,
  '42501', null, 'B kann keine Abteilung in A anlegen');
select throws_ok($$insert into core.member_roles (tenant_id, member_id, role_id) values
  ('11111111-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-00000000000b', '33333333-0000-4000-8000-000000000001')$$,
  '23503', null, 'B kann keine Rolle von A an sich vergeben');
update core.departments set name = 'Übernommen' where tenant_id = '11111111-0000-4000-8000-00000000000a';
select throws_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', false)$$,
  '42501', null, 'B kann Module von A nicht schalten');
select pg_temp.logout();
select is((select name from core.departments where id = '44444444-0000-4000-8000-000000000001'), 'Vertrieb',
  'Abteilung von A ist unverändert');

-- Module schalten ----------------------------------------------------------------
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', false)$$,
  '42501', null, 'Viewer schaltet keine Module');
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select throws_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'crm', true)$$,
  '22023', null, 'Geplante Module sind nicht aktivierbar');
select throws_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'core', false)$$,
  '22023', null, 'Der Kern ist nicht abschaltbar');
select lives_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', false)$$,
  'Admin schaltet Analytics ab');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'analytics.view'), 'Abgeschaltetes Modul: keine Rechte');
select ok(not analytics.has_org_role('11111111-0000-4000-8000-00000000000a', 'viewer'), 'Abgeschaltetes Modul: Analytics-Policies sperren');
select is((select count(*)::int from analytics.websites), 0, 'Abgeschaltetes Modul: keine Websites sichtbar');
select throws_ok($$select analytics.site_realtime('22222222-0000-4000-8000-00000000000a')$$, '42501', null,
  'Abgeschaltetes Modul: keine Echtzeitdaten über direkte Aufrufe');
select pg_temp.logout();
set local role anon;
select is(public.nova_ingest_event(jsonb_build_object('site_id', 'ns_00000000000000bb', 'type', 'pageview',
  'hostname', 'perm.example', 'pathname', '/', 'ip', '203.0.113.9', 'user_agent', 'Test')), 'ignored',
  'Abgeschaltetes Modul: keine Erfassung');
reset role;
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$select core.set_module_enabled('11111111-0000-4000-8000-00000000000a', 'analytics', true)$$,
  'Admin schaltet Analytics wieder ein');
select is((select count(*)::int from analytics.websites), 1, 'Website wieder sichtbar');
select pg_temp.logout();
set local role anon;
select is(public.nova_ingest_event(jsonb_build_object('site_id', 'ns_00000000000000bb', 'type', 'pageview',
  'hostname', 'perm.example', 'pathname', '/', 'ip', '203.0.113.9', 'user_agent', 'Test')), 'ok',
  'Freigeschaltet: Erfassung läuft');
reset role;

-- Sperre durch den Betreiber ----------------------------------------------------
update core.tenants set status = 'suspended', suspended_at = now() where id = '11111111-0000-4000-8000-00000000000a';
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'core.members.read'), 'Gesperrt: keine Rechte, auch nicht für Owner');
select is((select count(*)::int from analytics.websites), 0, 'Gesperrt: keine Analytics-Daten');
select is((select status from core.tenants where id = '11111111-0000-4000-8000-00000000000a'), 'suspended',
  'Gesperrt: Owner sieht den Status seines Unternehmens');
select pg_temp.logout();
set local role anon;
select is(public.nova_ingest_event(jsonb_build_object('site_id', 'ns_00000000000000bb', 'type', 'pageview',
  'hostname', 'perm.example', 'pathname', '/', 'ip', '203.0.113.9', 'user_agent', 'Test')), 'unknown_site',
  'Gesperrt: keine Erfassung');
reset role;
update core.tenants set status = 'active', suspended_at = null where id = '11111111-0000-4000-8000-00000000000a';

-- Unternehmensprofil ---------------------------------------------------------------
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
update core.tenants set city = 'Berlin', company_size = '11-50' where id = '11111111-0000-4000-8000-00000000000a';
select throws_ok($$update core.tenants set status = 'active' where id = '11111111-0000-4000-8000-00000000000a'$$,
  '42501', null, 'Kunden können den Sperrstatus nicht ändern');
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
update core.tenants set city = 'Hamburg' where id = '11111111-0000-4000-8000-00000000000a';
select pg_temp.logout();
select is((select city from core.tenants where id = '11111111-0000-4000-8000-00000000000a'), 'Berlin',
  'Admin ändert das Profil, Viewer nicht');
select throws_ok($$update core.tenants set company_size = 'riesig' where id = '11111111-0000-4000-8000-00000000000a'$$,
  '23514', null, 'Unternehmensgröße nur aus der Liste');

-- Protokoll ---------------------------------------------------------------------
select ok(exists (select 1 from core.audit_logs where action = 'role_permissions.insert'
  and metadata ->> 'permission' = 'core.departments.manage'), 'Rechtevergabe steht im Protokoll');
select ok(exists (select 1 from core.audit_logs where action = 'tenant_modules.update'
  and (metadata ->> 'enabled')::boolean = false), 'Abschalten eines Moduls steht im Protokoll');
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from core.audit_logs), 0, 'Viewer sieht kein Protokoll');
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select ok((select count(*) from core.audit_logs) > 0, 'Admin sieht das Protokoll');
select pg_temp.logout();

-- Löschen eines Unternehmens räumt alles ab -------------------------------------------
delete from core.tenants where id = '11111111-0000-4000-8000-00000000000a';
select is((select count(*)::int from core.roles where tenant_id = '11111111-0000-4000-8000-00000000000a')
        + (select count(*)::int from core.departments where tenant_id = '11111111-0000-4000-8000-00000000000a')
        + (select count(*)::int from core.tenant_modules where tenant_id = '11111111-0000-4000-8000-00000000000a'),
  0, 'Kaskade entfernt Rollen, Abteilungen und Module');

select * from finish();
rollback;
