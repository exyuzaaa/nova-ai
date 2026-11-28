-- =============================================================================
-- NOVA Finanzen – Belegversand per Gmail (Plattform-Phase 3a-2)
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
  ('a0000000-0000-0000-0000-00000000000a', 'a@mail.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@mail.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@mail.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@mail.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'mail-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'mail-b');
insert into core.tenant_members (tenant_id, user_id, role) values
  ('11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');
insert into crm.customers (id, tenant_id, name, street, city) values
  ('c5000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Kunde', 'Weg 1', 'Ort');
-- Entwurf, ausgestellte Rechnung, versendetes Angebot (direkt angelegt, Ausstellen ist in finance.test.sql geprüft)
insert into finance.documents (id, tenant_id, kind, customer_id, status, number) values
  ('f0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001', 'draft', null),
  ('f0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001', 'issued', 'RE-2026-0001'),
  ('f0000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-00000000000a', 'quote', 'c5000000-0000-4000-8000-000000000001', 'sent', 'AN-2026-0001');

-- Verbinden ---------------------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$select finance.connect_mail_account('11111111-0000-4000-8000-00000000000a', 'x@gmail.com', 'enc')$$, '42501', null,
  'Mitglieder verbinden kein Postfach');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$select finance.connect_mail_account('11111111-0000-4000-8000-00000000000a', ' Rechnung@Firma-A.example ', 'v1.alt')$$,
  'Owner verbindet Gmail');
select lives_ok($$select finance.connect_mail_account('11111111-0000-4000-8000-00000000000a', 'rechnung@firma-a.example', 'v1.neu')$$,
  'Erneutes Verbinden ersetzt die Verbindung');
select is((select email from finance.mail_accounts), 'rechnung@firma-a.example', 'Adresse sichtbar und normalisiert');
select throws_ok($$select refresh_token_enc from finance.mail_accounts$$, '42501', null, 'Token ist für Nutzer nicht lesbar');
select throws_ok($$update finance.mail_accounts set email = 'boese@example.com'$$, '42501', null, 'Kein direktes Ändern');
select throws_ok($$insert into finance.mail_accounts (tenant_id, email, refresh_token_enc) values ('11111111-0000-4000-8000-00000000000a', 'a@b.de', 'x')$$,
  '42501', null, 'Kein direktes Anlegen');
select pg_temp.logout();

-- Zugang zum Versand ------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$select * from finance.mail_credentials('f0000000-0000-4000-8000-000000000001')$$, '22023', null,
  'Entwürfe werden nicht versendet');
select is((select refresh_token_enc from finance.mail_credentials('f0000000-0000-4000-8000-000000000002')), 'v1.neu',
  'Owner erhält den (verschlüsselten) Zugang für eine Rechnung');
select pg_temp.logout();

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$select * from finance.mail_credentials('f0000000-0000-4000-8000-000000000002')$$, '42501', null,
  'Mitglieder versenden keine Rechnungen');
select is((select email from finance.mail_credentials('f0000000-0000-4000-8000-000000000003')), 'rechnung@firma-a.example',
  'Mitglieder versenden Angebote');
select lives_ok($$select finance.record_document_email('f0000000-0000-4000-8000-000000000003', 'rechnung@firma-a.example',
  array['kunde@example.com'], '{}', 'Angebot AN-2026-0001', 'msg-1')$$, 'Versand wird protokolliert');
select throws_ok($$select finance.record_document_email('f0000000-0000-4000-8000-000000000002', 'x', array['k@example.com'], '{}', 'S', null)$$,
  '42501', null, 'Kein Protokoll ohne Versandrecht');
select throws_ok($$insert into finance.document_emails (tenant_id, document_id, sent_from, recipients, subject)
  values ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000002', 'x', array['k@example.com'], 'gefälscht')$$,
  '42501', null, 'Kein direkter Eintrag ins Versandprotokoll');
select is((select count(*)::int from finance.document_emails), 1, 'Mitglied sieht das Versandprotokoll');
select lives_ok($$select finance.record_mail_error('f0000000-0000-4000-8000-000000000003', 'invalid_grant')$$, 'Fehler wird vermerkt');
select is((select last_error from finance.mail_accounts), 'invalid_grant', 'Fehler in den Einstellungen sichtbar');
select pg_temp.logout();

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from finance.mail_accounts), 0, 'Betrachter sehen die Verbindung nicht');
select throws_ok($$select * from finance.mail_credentials('f0000000-0000-4000-8000-000000000003')$$, 'P0002', null, 'Betrachter erhalten keinen Zugang');
select pg_temp.logout();

-- Fremdes Unternehmen -----------------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from finance.mail_accounts), 0, 'Fremde Verbindung unsichtbar');
select is((select count(*)::int from finance.document_emails), 0, 'Fremdes Versandprotokoll unsichtbar');
select throws_ok($$select * from finance.mail_credentials('f0000000-0000-4000-8000-000000000002')$$, 'P0002', null, 'Kein Zugang zu fremden Belegen');
select throws_ok($$select finance.connect_mail_account('11111111-0000-4000-8000-00000000000a', 'b@gmail.com', 'x')$$, '42501', null,
  'Kein Verbinden in fremden Unternehmen');
select throws_ok($$select finance.disconnect_mail_account('11111111-0000-4000-8000-00000000000a')$$, '42501', null,
  'Kein Trennen in fremden Unternehmen');
select pg_temp.logout();

-- Trennen und Protokoll ---------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is(finance.disconnect_mail_account('11111111-0000-4000-8000-00000000000a'), 'v1.neu', 'Trennen liefert das Token zum Widerruf');
select is((select count(*)::int from finance.mail_accounts), 0, 'Verbindung entfernt');
select is(finance.disconnect_mail_account('11111111-0000-4000-8000-00000000000a'), null, 'Erneutes Trennen ist harmlos');
select pg_temp.logout();

select is((select array_agg(action order by created_at, action) from core.audit_logs
  where tenant_id = '11111111-0000-4000-8000-00000000000a' and (action like 'finance.mail.%' or action = 'finance.documents.email')),
  array['finance.documents.email', 'finance.mail.connect', 'finance.mail.connect', 'finance.mail.disconnect'],
  'Verbinden, Versand und Trennen stehen im Protokoll');
select ok(not exists (select 1 from core.audit_logs where metadata::text like '%v1.%'), 'Kein Token im Protokoll');

select * from finish();
rollback;
