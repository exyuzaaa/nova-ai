-- =============================================================================
-- NOVA CRM – Pipeline-Einstellungen, Import-Dubletten, Export-Protokoll (Phase 2a-4b)
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

-- A: a Owner, d Mitglied · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@set.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@set.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@set.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'set-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'set-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

create temp table ids as
select (select id from crm.pipelines where tenant_id = '11111111-0000-4000-8000-00000000000a' and is_default) as pipeline,
       (select id from crm.pipeline_stages s where s.tenant_id = '11111111-0000-4000-8000-00000000000a' and s.name = 'Angebot') as offer,
       (select id from crm.pipeline_stages s where s.tenant_id = '11111111-0000-4000-8000-00000000000a' and s.name = 'Gewonnen') as won,
       (select id from crm.pipeline_stages s where s.tenant_id = '11111111-0000-4000-8000-00000000000a' and s.name = 'Neu') as first_stage;
grant select on ids to authenticated;

-- Phasen -----------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$update crm.pipeline_stages set name = 'Angebot verschickt', probability = 60 where id = (select offer from ids)$$,
  'Admin benennt Phase um und ändert die Wahrscheinlichkeit');
select throws_ok($$update crm.pipeline_stages set kind = 'won' where id = (select offer from ids)$$, '23514', null,
  'Art einer Phase ist unveränderlich');
select throws_ok($$delete from crm.pipeline_stages where id = (select won from ids)$$, '23514', null,
  '„Gewonnen“ kann nicht gelöscht werden');

select lives_ok($$select crm.move_stage((select offer from ids), true)$$, 'Phase nach oben verschieben');
select is((select array_agg(name order by position) from crm.pipeline_stages where pipeline_id = (select pipeline from ids)),
  array['Neu', 'Angebot verschickt', 'Qualifiziert', 'Verhandlung', 'Gewonnen', 'Verloren'], 'Reihenfolge getauscht, lückenlos');
select lives_ok($$select crm.move_stage((select first_stage from ids), true)$$, 'Erste Phase bleibt oben');
select crm.move_stage((select id from crm.pipeline_stages where name = 'Verhandlung' and pipeline_id = (select pipeline from ids)), false);
select is((select array_agg(name order by position) from crm.pipeline_stages where pipeline_id = (select pipeline from ids)),
  array['Neu', 'Angebot verschickt', 'Qualifiziert', 'Verhandlung', 'Gewonnen', 'Verloren'], 'Offene Phasen rutschen nicht hinter „Gewonnen“');

-- Phase mit Verkaufschance kann nicht gelöscht werden
insert into crm.customers (id, tenant_id, name, email) values
  ('c5000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Müller GmbH', 'info@mueller.example');
insert into crm.opportunities (tenant_id, title, customer_id, pipeline_id, stage_id, amount)
select '11111111-0000-4000-8000-00000000000a', 'Auftrag', 'c5000000-0000-4000-8000-000000000001', pipeline, offer, 1000 from ids;
select throws_ok($$delete from crm.pipeline_stages where id = (select offer from ids)$$, '23503', null,
  'Phase mit Verkaufschancen bleibt erhalten');
select lives_ok($$delete from crm.pipeline_stages where name = 'Qualifiziert' and pipeline_id = (select pipeline from ids)$$,
  'Leere offene Phase lässt sich löschen');

-- Weitere Pipeline
select lives_ok($$select crm.create_pipeline('11111111-0000-4000-8000-00000000000a', ' Service ')$$, 'Admin legt Pipeline an');
select is((select array_agg(s.name order by s.position) from crm.pipeline_stages s join crm.pipelines p on p.id = s.pipeline_id where p.name = 'Service'),
  array['Neu', 'Angebot', 'Gewonnen', 'Verloren'], 'Neue Pipeline hat Grundphasen');
select throws_ok($$select crm.create_pipeline('11111111-0000-4000-8000-00000000000a', 'service')$$, '23505', null,
  'Pipelinenamen sind eindeutig');
select throws_ok($$delete from crm.pipeline_stages where name = 'Angebot' and pipeline_id = (select id from crm.pipelines where name = 'Service')$$
  || $$; delete from crm.pipeline_stages where name = 'Neu' and pipeline_id = (select id from crm.pipelines where name = 'Service')$$,
  '23514', null, 'Letzte offene Phase bleibt erhalten');
select throws_ok($$delete from crm.pipelines where id = (select pipeline from ids)$$, '23514', null, 'Standard-Pipeline nicht löschbar');
select lives_ok($$select crm.set_default_pipeline((select id from crm.pipelines where name = 'Service'))$$, 'Standard wechseln');
select is((select name from crm.pipelines where tenant_id = '11111111-0000-4000-8000-00000000000a' and is_default), 'Service',
  'Genau eine Standard-Pipeline');
select throws_ok($$delete from crm.pipelines where id = (select pipeline from ids)$$, '23503', null,
  'Pipeline mit Verkaufschancen bleibt erhalten');
select pg_temp.logout();
select is((select array_agg(action || ':' || (metadata ->> 'name') order by created_at, action) from core.audit_logs
           where tenant_id = '11111111-0000-4000-8000-00000000000a' and action like 'crm.pipeline_stages.%'),
  array['crm.pipeline_stages.delete:Qualifiziert', 'crm.pipeline_stages.update:Angebot verschickt'],
  'Protokoll: Umbenennen und Löschen, nicht aber Grundphasen oder Umsortieren');

-- Mitglied und fremdes Unternehmen ------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$select crm.create_pipeline('11111111-0000-4000-8000-00000000000a', 'Heimlich')$$, '42501', null,
  'Mitglied darf keine Pipeline anlegen');
update crm.pipeline_stages set name = 'X' where id = (select won from ids);
select throws_ok($$select crm.set_default_pipeline((select pipeline from ids))$$, '42501', null, 'Mitglied darf Standard nicht ändern');
select pg_temp.logout();
select is((select name from crm.pipeline_stages where id = (select won from ids)), 'Gewonnen', 'Mitglied ändert keine Phasen');

select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select throws_ok($$select crm.move_stage((select offer from ids), true)$$, 'P0002', null, 'Fremde Phase ist unsichtbar');
select throws_ok($$select crm.set_default_pipeline((select pipeline from ids))$$, 'P0002', null, 'Fremde Pipeline ist unsichtbar');
select is((select count(*)::int from crm.import_duplicates('11111111-0000-4000-8000-00000000000a',
  '[{"name": "Müller GmbH", "email": ""}]')), 0, 'Import-Abgleich sieht keine fremden Kunden');
select throws_ok($$select crm.log_export('11111111-0000-4000-8000-00000000000a', 'customers', 1)$$, '42501', null,
  'Export fremder Unternehmen wird nicht protokolliert');
select pg_temp.logout();

-- Import-Dubletten ----------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select results_eq($$select row_index, number from crm.import_duplicates('11111111-0000-4000-8000-00000000000a',
  '[{"name": "Neu AG", "email": ""}, {"name": " müller gmbh ", "email": ""}, {"name": "Andere", "email": "INFO@mueller.example"}, {"name": "Leer", "email": ""}]')$$,
  $$values (1, 'K-00001'), (2, 'K-00001')$$, 'Dubletten über Name und E-Mail, ohne Groß-/Kleinschreibung');

-- Export-Protokoll
select lives_ok($$select crm.log_export('11111111-0000-4000-8000-00000000000a', 'customers', 12)$$, 'Mitglied darf exportieren');
select throws_ok($$select crm.log_export('11111111-0000-4000-8000-00000000000a', 'users', 1)$$, '22023', null, 'Nur bekannte Exporte');
select pg_temp.logout();
select is((select metadata ->> 'rows' from core.audit_logs where action = 'crm.export' and tenant_id = '11111111-0000-4000-8000-00000000000a'),
  '12', 'Export steht im Protokoll');
select is((select actor_id from core.audit_logs where action = 'crm.export' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 'd0000000-0000-0000-0000-00000000000d'::uuid,
  'mit der exportierenden Person');

-- Ohne Anmeldung
set local role anon;
select throws_ok($$select crm.log_export('11111111-0000-4000-8000-00000000000a', 'customers', 1)$$, '42501', null,
  'Gäste dürfen nichts aufrufen');
reset role;

select * from finish();
rollback;
