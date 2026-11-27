-- =============================================================================
-- NOVA CRM – Datenbanktests (Plattform-Phase 2a)
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

-- A: a Owner, d Mitglied, c Betrachter · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@crm.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@crm.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@crm.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@crm.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'crm-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'crm-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

-- Einrichtung ------------------------------------------------------------------------
select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'crm'), 'CRM ist für neue Unternehmen freigeschaltet');
select is((select count(*)::int from crm.pipelines where tenant_id = '11111111-0000-4000-8000-00000000000a' and is_default), 1,
  'Standard-Pipeline wird angelegt');
select is((select array_agg(s.name order by s.position) from crm.pipeline_stages s join crm.pipelines p on p.id = s.pipeline_id
           where p.tenant_id = '11111111-0000-4000-8000-00000000000a'),
  array['Neu', 'Qualifiziert', 'Angebot', 'Verhandlung', 'Gewonnen', 'Verloren'], 'Sechs Standardphasen');

-- Kunden: Rechte und Nummern ---------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$insert into crm.customers (id, tenant_id, name, email, city, owner_member_id) values
  ('c5000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Müller Maschinenbau GmbH', 'info@mueller-mb.example', 'Augsburg',
   'a1000000-0000-4000-8000-00000000000a')$$, 'Mitglied legt Kunden an');
insert into crm.customers (id, tenant_id, name, number) values
  ('c5000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', 'Schmidt Logistik', 'EIGENE-NUMMER');
select is((select array_agg(number order by number) from crm.customers where tenant_id = '11111111-0000-4000-8000-00000000000a'),
  array['K-00001', 'K-00002'], 'Fortlaufende Kundennummern, eigene Nummern werden ersetzt');
update crm.customers set number = 'K-99999' where id = 'c5000000-0000-4000-8000-000000000001';
select is((select number from crm.customers where id = 'c5000000-0000-4000-8000-000000000001'), 'K-00001', 'Nummern sind unveränderlich');
delete from crm.customers where id = 'c5000000-0000-4000-8000-000000000002';
select pg_temp.logout();
select is((select count(*)::int from crm.customers where id = 'c5000000-0000-4000-8000-000000000002'), 1, 'Löschen ohne crm.manage hat keine Wirkung');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from crm.customers), 2, 'Betrachter sieht Kunden');
select throws_ok($$insert into crm.customers (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'X')$$,
  '42501', null, 'Betrachter legt keine Kunden an');
select pg_temp.logout();

-- Ansprechpartner
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into crm.contacts (tenant_id, customer_id, first_name, last_name, position, is_primary) values
  ('11111111-0000-4000-8000-00000000000a', 'c5000000-0000-4000-8000-000000000001', 'Anna', 'Müller', 'Geschäftsführerin', true);
select throws_ok($$insert into crm.contacts (tenant_id, customer_id, first_name, is_primary) values
  ('11111111-0000-4000-8000-00000000000a', 'c5000000-0000-4000-8000-000000000001', 'Ben', true)$$,
  '23505', null, 'Nur ein Hauptansprechpartner je Kunde');
select throws_ok($$insert into crm.contacts (tenant_id, customer_id) values
  ('11111111-0000-4000-8000-00000000000a', 'c5000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'Ansprechpartner brauchen einen Namen');

-- Dubletten
select is((select reason from crm.find_duplicates('11111111-0000-4000-8000-00000000000a', 'Neue Firma', 'INFO@mueller-mb.example')),
  'email', 'Dublette über gleiche E-Mail-Adresse');
select is((select name from crm.find_duplicates('11111111-0000-4000-8000-00000000000a', 'Mueller Maschinenbau GmbH')),
  'Müller Maschinenbau GmbH', 'Dublette über ähnlichen Namen');
select is((select count(*)::int from crm.find_duplicates('11111111-0000-4000-8000-00000000000a', 'Völlig anderer Name')), 0,
  'Keine falschen Dubletten');
select pg_temp.logout();

-- Mandantentrennung -----------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from crm.customers), 0, 'B sieht keine Kunden von A');
select is((select count(*)::int from crm.contacts), 0, 'B sieht keine Ansprechpartner von A');
select is((select count(*)::int from crm.find_duplicates('11111111-0000-4000-8000-00000000000a', 'Müller Maschinenbau GmbH')), 0,
  'Dublettenprüfung verrät nichts über A');
select throws_ok($$insert into crm.customers (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'Eingeschleust')$$,
  '42501', null, 'B kann keine Kunden in A anlegen');
insert into crm.customers (id, tenant_id, name) values ('c5000000-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-00000000000b', 'Kunde B');
select is((select number from crm.customers where id = 'c5000000-0000-4000-8000-0000000000b1'), 'K-00001', 'Nummernkreis je Unternehmen');
select throws_ok($$insert into crm.contacts (tenant_id, customer_id, first_name) values
  ('11111111-0000-4000-8000-00000000000b', 'c5000000-0000-4000-8000-000000000001', 'Fremd')$$,
  '23503', null, 'Ansprechpartner kann nicht an einen Kunden von A gehängt werden');
update crm.customers set name = 'Übernommen' where id = 'c5000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select name from crm.customers where id = 'c5000000-0000-4000-8000-000000000001'), 'Müller Maschinenbau GmbH', 'Kunde von A unverändert');

-- Verkaufschancen ---------------------------------------------------------------------
create temp table pipe as
  select p.id as pipeline_id,
         (select id from crm.pipeline_stages where pipeline_id = p.id and name = 'Neu') as stage_new,
         (select id from crm.pipeline_stages where pipeline_id = p.id and name = 'Gewonnen') as stage_won,
         (select s.id from crm.pipeline_stages s join crm.pipelines pb on pb.id = s.pipeline_id
          where pb.tenant_id = '11111111-0000-4000-8000-00000000000b' and s.name = 'Neu') as stage_b
  from crm.pipelines p where p.tenant_id = '11111111-0000-4000-8000-00000000000a' and p.is_default;
grant select on pipe to authenticated;

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok(format($$insert into crm.opportunities (id, tenant_id, title, customer_id, pipeline_id, stage_id, amount, owner_member_id)
  values ('0a000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Wartungsvertrag 2027',
          'c5000000-0000-4000-8000-000000000001', %L, %L, 24000, 'a1000000-0000-4000-8000-00000000000a')$$,
  (select pipeline_id from pipe), (select stage_new from pipe)), 'Verkaufschance anlegen');
select throws_ok(format($$insert into crm.opportunities (tenant_id, title, customer_id, pipeline_id, stage_id)
  values ('11111111-0000-4000-8000-00000000000a', 'Falsche Phase', 'c5000000-0000-4000-8000-000000000001', %L, %L)$$,
  (select pipeline_id from pipe), (select stage_b from pipe)), '23503', null, 'Phase muss zur Pipeline und zum Unternehmen gehören');
select is((select closed_at from crm.opportunities where id = '0a000000-0000-4000-8000-000000000001'), null, 'Offene Chance hat kein Abschlussdatum');
update crm.opportunities set stage_id = (select stage_won from pipe) where id = '0a000000-0000-4000-8000-000000000001';
select isnt((select closed_at from crm.opportunities where id = '0a000000-0000-4000-8000-000000000001'), null, 'Gewonnen setzt das Abschlussdatum');
update crm.opportunities set stage_id = (select stage_new from pipe) where id = '0a000000-0000-4000-8000-000000000001';
select is((select closed_at from crm.opportunities where id = '0a000000-0000-4000-8000-000000000001'), null, 'Zurück auf offen entfernt es wieder');
select is((select number from crm.opportunities where id = '0a000000-0000-4000-8000-000000000001'), 'V-00001', 'Nummer V-00001');
select pg_temp.logout();

-- Benachrichtigung über Zuständigkeit (d weist a zu → a wird informiert)
select ok(exists (select 1 from core.notifications where user_id = 'a0000000-0000-0000-0000-00000000000a' and kind = 'crm.assigned'
  and title like '%Müller Maschinenbau%'), 'Zuständigkeit für Kunden wird gemeldet');
select ok(exists (select 1 from core.notifications where user_id = 'a0000000-0000-0000-0000-00000000000a' and kind = 'crm.assigned'
  and title like '%Wartungsvertrag%'), 'Zuständigkeit für Verkaufschance wird gemeldet');

-- Leads und Umwandlung ------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into crm.leads (id, tenant_id, title, company_name, contact_name, email, source, estimated_value, follow_up_at)
values ('1e000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Anfrage Website-Relaunch',
        'Bäckerei Sonne', 'Maria Clara Sonne', 'maria@sonne.example', 'website', 8500, now() - interval '1 minute');
insert into crm.activities (tenant_id, lead_id, kind, subject) values
  ('11111111-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-000000000001', 'call', 'Erstgespräch');
select throws_ok($$insert into crm.activities (tenant_id, lead_id, subject, created_by) values
  ('11111111-0000-4000-8000-00000000000a', '1e000000-0000-4000-8000-000000000001', 'Gefälscht', 'a0000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'Aktivitäten können nicht im Namen anderer angelegt werden');
select is((select number from crm.leads where id = '1e000000-0000-4000-8000-000000000001'), 'L-00001', 'Lead-Nummer L-00001');
select pg_temp.logout();

-- Wiedervorlage
select is(crm.send_reminders(), 1, 'Fällige Wiedervorlage wird gemeldet');
select ok(exists (select 1 from core.notifications where user_id = 'd0000000-0000-0000-0000-00000000000d' and kind = 'crm.follow_up.due'),
  'Ohne Zuständigen erhält der Ersteller die Wiedervorlage');
select is(crm.send_reminders(), 0, 'Jede Wiedervorlage nur einmal');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update crm.leads set follow_up_at = now() - interval '10 seconds' where id = '1e000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is(crm.send_reminders(), 1, 'Verschobene Wiedervorlage erinnert erneut');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok($$select crm.convert_lead('1e000000-0000-4000-8000-000000000001')$$, '42501', null, 'Betrachter wandeln keine Leads um');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
create temp table converted as select crm.convert_lead('1e000000-0000-4000-8000-000000000001', null, true) as customer_id;
select is((select name from crm.customers where id = (select customer_id from converted)), 'Bäckerei Sonne', 'Kunde aus Lead angelegt');
select is((select first_name || '|' || last_name from crm.contacts where customer_id = (select customer_id from converted)),
  'Maria Clara|Sonne', 'Ansprechpartner aus Lead angelegt');
select is((select status from crm.leads where id = '1e000000-0000-4000-8000-000000000001'), 'converted', 'Lead ist umgewandelt');
select is((select amount from crm.opportunities where lead_id = '1e000000-0000-4000-8000-000000000001'), 8500.00::numeric,
  'Verkaufschance mit geschätztem Wert');
select is((select customer_id from crm.activities where subject = 'Erstgespräch'), (select customer_id from converted),
  'Aktivitäten des Leads erscheinen beim Kunden');
select throws_ok($$select crm.convert_lead('1e000000-0000-4000-8000-000000000001')$$, '22023', null, 'Zweite Umwandlung wird abgelehnt');
select pg_temp.logout();

-- Aufgaben: Fälligkeit
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
insert into crm.activities (tenant_id, customer_id, kind, subject, due_at, assigned_member_id) values
  ('11111111-0000-4000-8000-00000000000a', 'c5000000-0000-4000-8000-000000000001', 'task', 'Angebot nachfassen',
   now() - interval '1 minute', 'd1000000-0000-4000-8000-00000000000d');
select pg_temp.logout();
select ok(exists (select 1 from core.notifications where user_id = 'd0000000-0000-0000-0000-00000000000d' and kind = 'crm.task.assigned'),
  'Zugewiesene Aufgabe wird gemeldet');
select is(crm.send_reminders(), 1, 'Fällige Aufgabe wird gemeldet');

-- Suche -------------------------------------------------------------------------------
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select set_eq($$select entity_type from core.search('11111111-0000-4000-8000-00000000000a', 'sonne')$$,
  array['customer', 'contact', 'lead', 'opportunity'], 'Suche findet Kunde, Ansprechpartner, Lead und Verkaufschance');
select is((select href from core.search('11111111-0000-4000-8000-00000000000a', 'K-00001') limit 1),
  'crm/kunden/c5000000-0000-4000-8000-000000000001', 'Suche nach Kundennummer');
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from core.search('11111111-0000-4000-8000-00000000000a', 'sonne')), 0, 'B findet nichts von A');
select pg_temp.logout();

-- Protokoll
select ok(exists (select 1 from core.audit_logs where action = 'crm.customers.insert' and metadata ->> 'number' = 'K-00001'),
  'Kundenanlage steht im Protokoll');

-- Modul ausschalten sperrt alles
update core.tenant_modules set enabled = false where tenant_id = '11111111-0000-4000-8000-00000000000a' and module_key = 'crm';
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from crm.customers), 0, 'Ausgeschaltetes CRM: keine Kunden sichtbar');
select throws_ok($$insert into crm.customers (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'X')$$,
  '42501', null, 'Ausgeschaltetes CRM: keine Anlage');
select pg_temp.logout();

-- Owner darf löschen; Kaskade entfernt Ansprechpartner, Chancen und Aktivitäten
update core.tenant_modules set enabled = true where tenant_id = '11111111-0000-4000-8000-00000000000a' and module_key = 'crm';
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
delete from crm.customers where id = 'c5000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select count(*)::int from crm.contacts where customer_id = 'c5000000-0000-4000-8000-000000000001')
        + (select count(*)::int from crm.opportunities where customer_id = 'c5000000-0000-4000-8000-000000000001')
        + (select count(*)::int from crm.activities where customer_id = 'c5000000-0000-4000-8000-000000000001'), 0,
  'Löschen eines Kunden entfernt abhängige Daten');
select is((select count(*)::int from core.search_index where entity_id = 'c5000000-0000-4000-8000-000000000001'), 0,
  'und den Sucheintrag');

select * from finish();
rollback;
