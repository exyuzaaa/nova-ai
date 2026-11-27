-- =============================================================================
-- NOVA CORE – Datenbanktests: Sitzungen und Zwei-Faktor-Anmeldung (Phase 1d)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.login(p_user uuid, p_session uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'session_id', p_session, 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@session.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@session.example', now(), 'authenticated', 'authenticated');
insert into auth.sessions (id, user_id, created_at, updated_at, aal, user_agent, ip) values
  ('5a000000-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-00000000000a', now() - interval '2 days', now() - interval '1 day', 'aal1', 'Mozilla/5.0 (iPhone)', '198.51.100.7'),
  ('5a000000-0000-4000-8000-000000000002', 'a0000000-0000-0000-0000-00000000000a', now(), now(), 'aal1', 'Mozilla/5.0 (Windows NT 10.0)', '198.51.100.8'),
  ('5b000000-0000-4000-8000-000000000001', 'b0000000-0000-0000-0000-00000000000b', now(), now(), 'aal1', 'Mozilla/5.0', '198.51.100.9');
insert into core.tenants (id, name, slug) values ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'session-a');
insert into core.tenant_members (tenant_id, user_id, role) values
  ('11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner');
insert into analytics.websites (organization_id, name, domain) values ('11111111-0000-4000-8000-00000000000a', 'Site', 'session.example');

-- Gültige Sitzung ------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a', '5a000000-0000-4000-8000-000000000002');
select ok(core.session_ok(), 'Gültige Sitzung ohne zweiten Faktor');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.members.read'), 'Rechte mit gültiger Sitzung');
select is((select count(*)::int from core.my_sessions()), 2, 'Eigene Sitzungen sichtbar');
select is((select bool_or(is_current) from core.my_sessions()), true, 'Aktuelle Sitzung ist markiert');
select is((select ip from core.my_sessions() where not is_current), '198.51.100.7', 'Gerätedaten werden angezeigt');
select throws_ok($$select core.revoke_session('5a000000-0000-4000-8000-000000000002')$$, '22023', null,
  'Die aktuelle Sitzung wird nicht über revoke_session beendet');
select is(core.revoke_session('5b000000-0000-4000-8000-000000000001'), false, 'Fremde Sitzungen können nicht beendet werden');
select is(core.revoke_session('5a000000-0000-4000-8000-000000000001'), true, 'Eigenes anderes Gerät abmelden');
select pg_temp.logout();
select is((select count(*)::int from auth.sessions where id = '5b000000-0000-4000-8000-000000000001'), 1, 'Fremde Sitzung besteht weiter');
select ok(exists (select 1 from core.audit_logs where action = 'auth.session.revoked'), 'Abmelden eines Geräts wird protokolliert');

-- Widerrufene Sitzung verliert sofort den Zugriff -------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a', '5a000000-0000-4000-8000-000000000001');
select ok(not core.session_ok(), 'Beendete Sitzung ist ungültig');
select ok(not core.can('11111111-0000-4000-8000-00000000000a', 'core.members.read'), 'Beendete Sitzung: keine Rechte');
select is((select count(*)::int from core.tenant_members), 0, 'Beendete Sitzung: keine Mitgliedschaften sichtbar');
select is((select count(*)::int from analytics.websites), 0, 'Beendete Sitzung: keine Analytics-Daten');
select pg_temp.logout();

-- Zweiter Faktor --------------------------------------------------------------------
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('fa000000-0000-4000-8000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Authenticator', 'totp', 'verified', now(), now());
select pg_temp.login('a0000000-0000-0000-0000-00000000000a', '5a000000-0000-4000-8000-000000000002', 'aal1');
select ok(core.my_mfa_required(), 'Faktor ist eingerichtet');
select ok(not core.session_ok(), 'Mit Faktor reicht das Passwort allein nicht (aal1)');
select ok(not core.has_tenant_role('11111111-0000-4000-8000-00000000000a', 'viewer'), 'aal1: keine Unternehmensdaten');
select is((select count(*)::int from analytics.websites), 0, 'aal1: keine Analytics-Daten');
select throws_ok($$select core.revoke_session('5b000000-0000-4000-8000-000000000001')$$, '42501', null,
  'aal1: keine Geräteverwaltung');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a', '5a000000-0000-4000-8000-000000000002', 'aal2');
select ok(core.session_ok(), 'Mit bestätigtem Faktor (aal2) gültig');
select ok(core.can('11111111-0000-4000-8000-00000000000a', 'core.members.read'), 'aal2: Rechte wie gewohnt');
select is((select count(*)::int from analytics.websites), 1, 'aal2: Analytics-Daten sichtbar');
select pg_temp.logout();

-- Unbestätigte Faktoren zählen nicht
update auth.mfa_factors set status = 'unverified' where id = 'fa000000-0000-4000-8000-000000000001';
select pg_temp.login('a0000000-0000-0000-0000-00000000000a', '5a000000-0000-4000-8000-000000000002', 'aal1');
select ok(core.session_ok(), 'Unbestätigter Faktor erzwingt nichts');
select pg_temp.logout();

set local role anon;
select throws_ok($$select * from core.my_sessions()$$, '42501', null, 'anon sieht keine Sitzungen');
reset role;

select * from finish();
rollback;
