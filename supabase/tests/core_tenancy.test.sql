-- =============================================================================
-- NOVA CORE – Datenbanktests: gemeinsamer Kern (Plattform-Phase 1a)
-- Struktur nach dem Umzug, Mandantentrennung A gegen B, Rechte neuer Schemas.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Struktur --------------------------------------------------------------------
select has_table('core', 'tenants', 'core.tenants existiert');
select has_table('core', 'tenant_members', 'core.tenant_members existiert');
select has_table('core', 'invitations', 'core.invitations existiert');
select has_table('core', 'tenant_branding', 'core.tenant_branding existiert');
select has_table('core', 'audit_logs', 'core.audit_logs existiert');
select hasnt_table('analytics', 'organizations', 'analytics.organizations wurde verschoben');
select hasnt_table('analytics', 'organization_members', 'analytics.organization_members wurde verschoben');
select has_column('core', 'tenant_members', 'tenant_id', 'Mitglieder tragen tenant_id');
select enum_has_labels('core', 'member_role', array['viewer', 'member', 'admin', 'owner'], 'Rollen: viewer < member < admin < owner');
select fk_ok('analytics', 'websites', 'organization_id', 'core', 'tenants', 'id');

select is(
  (select array_agg(s order by s) from unnest(array['core', 'billing', 'platform', 'crm', 'projects', 'calendar', 'hr',
     'finance', 'documents', 'messaging', 'support', 'inventory', 'marketing', 'automation']) s
   where not exists (select 1 from pg_namespace n where n.nspname = s)),
  null, 'Alle Modul-Schemas sind angelegt');

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'core' and c.relkind = 'r'),
  'RLS ist auf allen Tabellen in core aktiv');

select ok(not has_schema_privilege('anon', 'core', 'usage'), 'anon hat keinen Zugriff auf core');
select ok(not has_schema_privilege('anon', 'crm', 'usage'), 'anon hat keinen Zugriff auf Modul-Schemas');

-- Neue Tabellen in Modul-Schemas sind ohne ausdrückliche Freigabe gesperrt
create table crm.probe (id int);
select ok(not has_table_privilege('authenticated', 'crm.probe', 'select'), 'Neue Modul-Tabelle: kein Zugriff für authenticated');
select ok(has_table_privilege('service_role', 'crm.probe', 'select'), 'Neue Modul-Tabelle: service_role hat Zugriff');
drop table crm.probe;

select ok(not has_function_privilege('authenticated', 'core.log_audit(uuid, text, text, text, jsonb)', 'execute'),
  'Clients können keine Audit-Einträge fälschen');

-- Mandantentrennung A gegen B --------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@example.com', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@example.com', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@example.com', now(), 'authenticated', 'authenticated');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
create temp table ids as select core.create_tenant('Firma A', 'firma-a') as a;
reset role;
alter table ids add column b uuid;
grant select on ids to authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select core.create_tenant('Firma B', 'firma-b')$$, 'B legt eigenes Unternehmen an');
reset role;
update ids set b = (select id from core.tenants where slug = 'firma-b');

-- B versucht, auf A zuzugreifen
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from core.tenants), 1, 'B sieht nur das eigene Unternehmen');
select is((select count(*)::int from core.tenant_members where tenant_id = (select a from ids)), 0, 'B sieht keine Mitglieder von A');
update core.tenants set name = 'gehackt' where id = (select a from ids);
select throws_ok(format('select core.create_invitation(%L, %L)', (select a from ids), 'x@example.com'),
  '42501', null, 'B kann nicht in A einladen');
select throws_ok(format('select * from core.list_members(%L)', (select a from ids)), '42501', null, 'B sieht keine Mitgliederliste von A');
select ok(not core.has_tenant_role((select a from ids), 'viewer'), 'B hat in A keine Rolle');
-- Eigene Mitgliedschaft in fremdes Unternehmen umhängen
select throws_ok(
  format('update core.tenant_members set tenant_id = %L where user_id = %L', (select a from ids), 'b0000000-0000-0000-0000-00000000000b'),
  '42501', null, 'Mitgliedschaft kann nicht in ein fremdes Unternehmen umgehängt werden');
reset role;
select is((select name from core.tenants where id = (select a from ids)), 'Firma A', 'Name von A ist unverändert');

-- Einladung als Mitglied (früher „Analyst“)
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
create temp table tok as select core.create_invitation((select a from ids), 'c@example.com', 'member') as t;
reset role;
grant select on tok to authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select is((select tenant_name from core.get_invitation((select t from tok))), 'Firma A', 'Einladung nennt das Unternehmen');
select is(core.accept_invitation((select t from tok)), (select a from ids), 'C tritt Firma A bei');
select ok(core.has_tenant_role((select a from ids), 'member'), 'C ist Mitglied');
select ok(not core.has_tenant_role((select a from ids), 'admin'), 'C ist kein Admin');
select ok(analytics.has_org_role((select a from ids), 'member'), 'Analytics-Hülle liefert dasselbe Ergebnis');
reset role;

-- Audit im gemeinsamen Protokoll
select ok(exists (select 1 from core.audit_logs where tenant_id = (select a from ids) and action = 'tenant_members.insert'
                  and metadata ->> 'role' = 'member'), 'Beitritt steht im Audit-Log');
select ok(exists (select 1 from core.audit_logs where tenant_id = (select a from ids) and action = 'tenants.insert'),
  'Anlage des Unternehmens steht im Audit-Log');

select * from finish();
rollback;
