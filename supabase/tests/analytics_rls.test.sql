-- =============================================================================
-- NOVA ANALYTICS – Datenbanktests: Mandantentrennung, Rollen, Einladungen
-- Ausführen: npx supabase test db
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

-- -----------------------------------------------------------------------------
-- Testhilfen (werden mit dem Rollback wieder entfernt)
-- -----------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.as_role(p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role)::text, true);
  perform set_config('role', p_role, true);
end $$;

create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'owner-a@example.com', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'owner-b@example.com', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'viewer-c@example.com', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'analyst-d@example.com', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'admin-e@example.com', now(), 'authenticated', 'authenticated'),
  ('f0000000-0000-0000-0000-00000000000f', 'fremd-f@example.com', now(), 'authenticated', 'authenticated'),
  ('90000000-0000-0000-0000-000000000009', 'unbestaetigt@example.com', null, 'authenticated', 'authenticated');

-- -----------------------------------------------------------------------------
-- Organisationen & Websites anlegen
-- -----------------------------------------------------------------------------
select tests.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$select core.create_tenant('Org A', 'org-a')$$, 'Owner A legt Organisation an');
insert into analytics.websites (organization_id, name, domain)
  select id, 'A1', 'a1.example.de' from core.tenants where slug = 'org-a';
insert into analytics.websites (organization_id, name, domain)
  select id, 'A2', 'a2.example.de' from core.tenants where slug = 'org-a';
select is((select count(*)::int from analytics.websites), 2, 'Owner A legt zwei Websites an');
select lives_ok(
  $$insert into analytics.websites (id, organization_id, name, domain)
    select 'aaaaaaaa-0000-4000-8000-000000000003', id, 'A3', 'a3.example.de' from core.tenants where slug = 'org-a'$$,
  'Website mit serverseitig erzeugter ID anlegen (Weg der App)');
select is((select name from analytics.websites where id = 'aaaaaaaa-0000-4000-8000-000000000003'), 'A3', 'Neue Website ist danach lesbar');
select tests.logout();
delete from analytics.websites where id = 'aaaaaaaa-0000-4000-8000-000000000003';
select tests.login('a0000000-0000-0000-0000-00000000000a');
select ok((select bool_and(public_site_id ~ '^ns_[a-f0-9]{16}$') from analytics.websites), 'Tracking-IDs werden automatisch erzeugt');
select is((select count(*)::int from analytics.tracking_settings), 2, 'Tracking-Einstellungen werden automatisch angelegt');
select is((select tracking_mode::text from analytics.tracking_settings limit 1), 'cookieless', 'Standardmodus ist cookieless');
select throws_ok(
  $$insert into analytics.websites (organization_id, name, domain, is_demo)
    select id, 'X', 'x.example.de', true from core.tenants where slug = 'org-a'$$,
  '42501', null, 'Demo-Kennzeichen kann nicht von Nutzern gesetzt werden');
select throws_ok(
  $$insert into analytics.websites (organization_id, name, domain)
    select id, 'X', 'Keine Domain!' from core.tenants where slug = 'org-a'$$,
  '23514', null, 'Ungültige Domains werden abgelehnt');
select tests.logout();

select tests.login('b0000000-0000-0000-0000-00000000000b');
select lives_ok($$select core.create_tenant('Org B', 'org-b')$$, 'Owner B legt Organisation an');
insert into analytics.websites (organization_id, name, domain)
  select id, 'B1', 'b1.example.de' from core.tenants where slug = 'org-b';
select tests.logout();

-- -----------------------------------------------------------------------------
-- Einladungen
-- -----------------------------------------------------------------------------
create temp table tokens (who text primary key, token text);
grant all on tokens to authenticated;

select tests.login('a0000000-0000-0000-0000-00000000000a');
insert into tokens
  select 'c', core.create_invitation(id, 'Viewer-C@example.com', 'viewer') from core.tenants where slug = 'org-a';
insert into tokens
  select 'd', core.create_invitation(id, 'analyst-d@example.com', 'member') from core.tenants where slug = 'org-a';
insert into tokens
  select 'e', core.create_invitation(id, 'admin-e@example.com', 'admin') from core.tenants where slug = 'org-a';
insert into tokens
  select 'g', core.create_invitation(id, 'unbestaetigt@example.com', 'viewer') from core.tenants where slug = 'org-a';
select is((select count(*)::int from core.invitations where accepted_at is null), 4, 'Owner A sieht vier offene Einladungen');
select ok((select bool_and(length(token) = 48) from tokens), 'Einladungstokens haben 192 Bit');
select ok(not exists (select 1 from core.invitations i join tokens t on i.token_hash = t.token),
  'Tokens werden nur gehasht gespeichert');
select throws_ok(
  $$select core.create_invitation((select id from core.tenants where slug = 'org-a'), 'x@example.com', 'owner')$$,
  '22023', null, 'Owner-Rolle kann nicht per Einladung vergeben werden');
select throws_ok(
  $$insert into core.tenant_members (tenant_id, user_id, role)
    select id, 'f0000000-0000-0000-0000-00000000000f', 'admin' from core.tenants where slug = 'org-a'$$,
  '42501', null, 'Mitglieder können nicht direkt eingefügt werden (nur per Einladung)');
select tests.logout();

select tests.login('c0000000-0000-0000-0000-00000000000c');
select is((select status from core.get_invitation((select token from tokens where who = 'c'))), 'pending', 'Einladung ist offen');
select is((select tenant_name from core.get_invitation((select token from tokens where who = 'c'))), 'Org A', 'Einladung nennt die Organisation');
select lives_ok($$select core.accept_invitation((select token from tokens where who = 'c'))$$, 'Viewer C nimmt Einladung an (E-Mail ohne Groß-/Kleinschreibung)');
select throws_ok($$select core.accept_invitation((select token from tokens where who = 'c'))$$, 'P0002', null, 'Einladung ist nur einmal verwendbar');
select tests.logout();

select tests.login('f0000000-0000-0000-0000-00000000000f');
select throws_ok($$select core.accept_invitation((select token from tokens where who = 'd'))$$, '42501', null, 'Fremde können Einladungen anderer nicht annehmen');
select throws_ok($$select core.accept_invitation('falsch')$$, 'P0002', null, 'Unbekanntes Token wird abgelehnt');
select tests.logout();

select tests.login('90000000-0000-0000-0000-000000000009');
select throws_ok($$select core.accept_invitation((select token from tokens where who = 'g'))$$, '42501', null, 'Unbestätigte E-Mail-Adresse kann nicht annehmen');
select tests.logout();

select tests.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$select core.accept_invitation((select token from tokens where who = 'd'))$$, 'Analyst D nimmt Einladung an');
select tests.logout();
select tests.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$select core.accept_invitation((select token from tokens where who = 'e'))$$, 'Admin E nimmt Einladung an');
select tests.logout();

select tests.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok(
  $$select core.create_invitation((select id from core.tenants where slug = 'org-a'), 'x@example.com', 'viewer')$$,
  '42501', null, 'Viewer darf nicht einladen');
select tests.logout();

-- Analyst D auf Website A2 beschränken (Owner)
select tests.login('a0000000-0000-0000-0000-00000000000a');
insert into analytics.organization_member_websites (member_id, website_id)
  select m.id, w.id from core.tenant_members m, analytics.websites w
  where m.user_id = 'd0000000-0000-0000-0000-00000000000d' and w.name = 'A2';
select tests.logout();

-- -----------------------------------------------------------------------------
-- Rohdaten wie die Ingestion schreiben (service_role)
-- -----------------------------------------------------------------------------
select tests.as_role('service_role');
insert into analytics.analytics_events
  (occurred_at, website_id, organization_id, session_id, visitor_hash, visitor_id_type, event_type, event_name, hostname, pathname)
select now() - make_interval(mins => g), w.id, w.organization_id, gen_random_uuid(), '\x01', 'daily_hash', 'pageview', 'pageview', 'h', '/'
from analytics.websites w
join (values ('A1', 3), ('A2', 5), ('B1', 7)) v(name, n) on v.name = w.name,
lateral generate_series(1, v.n) g;
select tests.logout();

-- -----------------------------------------------------------------------------
-- Mandantentrennung
-- -----------------------------------------------------------------------------
select tests.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from analytics.analytics_events), 8, 'Owner A sieht nur die 8 Events von Org A');
select is((select count(*)::int from core.tenants), 1, 'Owner A sieht nur die eigene Organisation');
select is((select count(*)::int from analytics.websites where name = 'B1'), 0, 'Owner A sieht keine Website von Org B');
update analytics.websites set name = 'gekapert' where name = 'B1';
select tests.logout();
select is((select count(*)::int from analytics.websites where name = 'gekapert'), 0, 'Owner A kann Website von Org B nicht ändern');

select tests.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from analytics.analytics_events), 7, 'Owner B sieht nur die 7 Events von Org B');
select is((select count(*)::int from analytics.tracking_settings), 1, 'Owner B sieht nur eigene Tracking-Einstellungen');
select throws_ok(
  format($$insert into analytics.websites (organization_id, name, domain) values (%L, 'X', 'x.example.de')$$,
         (select tenant_id from core.tenant_members where user_id = 'a0000000-0000-0000-0000-00000000000a')),
  '42501', null, 'Owner B kann keine Website in Org A anlegen');
select throws_ok(
  format($$select * from core.list_members(%L)$$,
         (select tenant_id from core.tenant_members where user_id = 'a0000000-0000-0000-0000-00000000000a')),
  '42501', null, 'Owner B kann Mitglieder von Org A nicht abfragen');
select is((select count(*)::int from core.audit_logs), 7, 'Owner B sieht die 7 Audit-Einträge des eigenen Unternehmens (inkl. Module und CRM-Pipeline)');
select is(
  (select count(*)::int from core.audit_logs
   where tenant_id <> (select tenant_id from core.tenant_members where user_id = 'b0000000-0000-0000-0000-00000000000b')),
  0, 'Owner B sieht keine Audit-Einträge fremder Organisationen');
select tests.logout();

-- -----------------------------------------------------------------------------
-- Rollen
-- -----------------------------------------------------------------------------
select tests.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from analytics.analytics_events), 8, 'Viewer C sieht Daten von Org A');
select throws_ok(
  $$insert into analytics.conversion_goals (website_id, name, goal_type, match_event_name)
    select id, 'x', 'event', 'x' from analytics.websites where name = 'A1'$$,
  '42501', null, 'Viewer C kann keine Ziele anlegen');
update core.tenant_members set role = 'admin' where user_id = 'c0000000-0000-0000-0000-00000000000c';
select is((select role::text from core.tenant_members where user_id = 'c0000000-0000-0000-0000-00000000000c'), 'viewer', 'Viewer C kann sich nicht selbst befördern');
update analytics.websites set name = 'umbenannt' where name = 'A1';
select is((select count(*)::int from analytics.websites where name = 'umbenannt'), 0, 'Viewer C kann Websites nicht ändern');
select is((select count(*)::int from core.audit_logs), 0, 'Viewer C sieht keine Audit-Logs');
select is((select count(*)::int from core.invitations), 0, 'Viewer C sieht keine Einladungen');
select is((select count(*)::int from core.list_members((select tenant_id from core.tenant_members limit 1))), 4, 'Viewer C sieht die Mitgliederliste');
select tests.logout();

select tests.login('d0000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from analytics.analytics_events), 5, 'Analyst D (beschränkt) sieht nur Events von A2');
select lives_ok(
  $$insert into analytics.conversion_goals (website_id, name, goal_type, match_event_name)
    select id, 'Kontakt', 'event', 'contact_form_submitted' from analytics.websites where name = 'A2'$$,
  'Analyst D legt Ziel auf freigegebener Website an');
update analytics.tracking_settings set tracking_mode = 'consent_required';
select is((select count(*)::int from analytics.tracking_settings where tracking_mode = 'consent_required'), 0, 'Analyst D kann Tracking-Einstellungen nicht ändern');
select throws_ok(
  $$insert into analytics.analytics_events (occurred_at, website_id, organization_id, session_id, visitor_hash, visitor_id_type, event_type, event_name, hostname, pathname)
    select now(), id, organization_id, gen_random_uuid(), '\x01', 'daily_hash', 'pageview', 'pageview', 'h', '/' from analytics.websites limit 1$$,
  '42501', null, 'Analyst D kann keine Rohdaten schreiben');
select tests.logout();

select tests.login('e0000000-0000-0000-0000-00000000000e');
select throws_ok(
  $$update core.tenant_members set role = 'owner' where user_id = 'c0000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'Admin E kann niemanden zum Owner machen');
select throws_ok(
  $$delete from core.tenant_members where user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Admin E kann den Owner nicht entfernen');
update core.tenant_members set role = 'member' where user_id = 'c0000000-0000-0000-0000-00000000000c';
select is((select role::text from core.tenant_members where user_id = 'c0000000-0000-0000-0000-00000000000c'), 'member', 'Admin E kann Viewer zum Analyst machen');
update analytics.tracking_settings set tracking_mode = 'consent_upgrade' where website_id = (select id from analytics.websites where name = 'A1');
select is((select tracking_mode::text from analytics.tracking_settings where website_id = (select id from analytics.websites where name = 'A1')), 'consent_upgrade', 'Admin E kann Tracking-Einstellungen ändern');
select throws_ok(
  $$update core.tenant_members set user_id = 'f0000000-0000-0000-0000-00000000000f' where user_id = 'c0000000-0000-0000-0000-00000000000c'$$,
  '42501', null, 'Mitgliedschaften können nicht auf andere Nutzer umgehängt werden');
select tests.logout();

select tests.login('c0000000-0000-0000-0000-00000000000c');
delete from core.tenant_members where user_id = 'c0000000-0000-0000-0000-00000000000c';
select tests.logout();
select is((select count(*)::int from core.tenant_members where user_id = 'c0000000-0000-0000-0000-00000000000c'), 0, 'Mitglied C kann die Organisation verlassen');

select tests.login('a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$delete from core.tenant_members where user_id = 'a0000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'Der letzte Owner kann die Organisation nicht verlassen');
select ok((select count(*) from core.audit_logs where action = 'tenant_members.update') >= 1, 'Rollenänderungen werden im Audit-Log festgehalten');
select ok(
  (select bool_and(metadata ? 'role') from core.audit_logs where action like 'tenant_members.%'),
  'Audit-Einträge enthalten die Rolle');
select ok(
  not exists (select 1 from core.audit_logs where metadata::text like '%token%'),
  'Audit-Log enthält keine Token');
select tests.logout();

-- -----------------------------------------------------------------------------
-- anon & service_role
-- -----------------------------------------------------------------------------
select tests.as_role('anon');
select throws_ok('select count(*) from analytics.analytics_events', '42501', null, 'anon hat keinen Zugriff auf Events');
select throws_ok('select count(*) from analytics.websites', '42501', null, 'anon hat keinen Zugriff auf Websites');
select throws_ok($$select core.get_invitation('x')$$, '42501', null, 'anon kann Einladungen nicht abfragen');
select tests.logout();

select tests.as_role('service_role');
select throws_ok('update core.audit_logs set action = action', '42501', null, 'Audit-Log ist auch für service_role unveränderlich');
select tests.logout();

select tests.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok('select analytics.ensure_partitions(1)', '42501', null, 'Wartungsfunktionen sind für Nutzer nicht ausführbar');
select tests.logout();

select ok(
  (select count(*) from pg_tables where schemaname = 'analytics' and tablename like 'analytics_events_20%') >= 4,
  'Monatspartitionen für Events existieren');

select * from finish();
rollback;
