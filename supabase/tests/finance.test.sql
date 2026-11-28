-- =============================================================================
-- NOVA Finanzen – Datenbanktests (Plattform-Phase 3a)
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
  ('a0000000-0000-0000-0000-00000000000a', 'a@fin.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@fin.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@fin.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@fin.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'fin-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'fin-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');
insert into crm.customers (id, tenant_id, name, street, postal_code, city, vat_id) values
  ('c5000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Müller GmbH', 'Hauptstraße 1', '80331', 'München', 'DE123456789');

select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'finance'), 'Finanzen sind freigeschaltet');

-- Entwurf und Summen ---------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into finance.documents (id, tenant_id, kind, customer_id, title) values
  ('f0000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001', 'Website');
insert into finance.document_lines (tenant_id, document_id, position, title, quantity, unit, unit_price, tax_rate) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000001', 1, 'Konzeption', 2, 'Std.', 100, 19);
insert into finance.document_lines (tenant_id, document_id, position, title, quantity, unit_price, discount_percent, tax_rate) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000001', 2, 'Fachbuch', 1, 50, 10, 7);
select is((select array[net_total, tax_total, gross_total] from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'),
  array[245.00, 41.15, 286.15]::numeric[], 'Netto, Umsatzsteuer je Satz, Brutto');
select is((select jsonb_array_length(tax_breakdown) from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 2, 'Aufteilung nach Steuersätzen');
select throws_ok($$insert into finance.documents (tenant_id, kind, status, number) values ('11111111-0000-4000-8000-00000000000a', 'invoice', 'issued', 'RE-1')$$,
  '42501', null, 'Ausgestellt anlegen geht nicht');
update finance.documents set status = 'paid', gross_total = 1 where id = 'f0000000-0000-4000-8000-000000000001';
select is((select status from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 'draft', 'Status und Beträge setzt nur die Datenbank');
select throws_ok($$select finance.issue_document('f0000000-0000-4000-8000-000000000001')$$, '42501', null, 'Mitglied stellt keine Rechnung aus');
select pg_temp.logout();

-- Ausstellen ------------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select throws_ok($$select finance.issue_document('f0000000-0000-4000-8000-000000000001', '2026-11-28')$$, '22023', null,
  'Ohne Rechnungsdaten des Unternehmens kein Ausstellen');
insert into finance.settings (tenant_id, legal_name, street, postal_code, city, tax_number, iban, payment_terms_days) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A GmbH', 'Werkstraße 5', '10115', 'Berlin', '27/123/45678', 'DE89370400440532013000', 10);
select is(finance.issue_document('f0000000-0000-4000-8000-000000000001', '2026-11-28'), 'RE-2026-0001', 'Erste Rechnungsnummer');
select is((select array[status, recipient_name, recipient_city, recipient_vat_id] from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'),
  array['issued', 'Müller GmbH', 'München', 'DE123456789'], 'Empfänger aus dem Kunden eingefroren');
select is((select due_date from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), '2026-12-08'::date, 'Fällig nach Zahlungsziel');
select is((select seller ->> 'legal_name' from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 'Firma A GmbH', 'Absender eingefroren');
update finance.settings set legal_name = 'Umfirmiert GmbH' where tenant_id = '11111111-0000-4000-8000-00000000000a';
select is((select seller ->> 'legal_name' from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 'Firma A GmbH',
  'Spätere Änderungen ändern ausgestellte Rechnungen nicht');

-- Lückenlos: gelöschte Entwürfe verbrauchen keine Nummer
insert into finance.documents (id, tenant_id, kind, customer_id) values
  ('f0000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001');
insert into finance.document_lines (tenant_id, document_id, title, quantity, unit_price) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000003', 'Wartung', 1, 100);
delete from finance.documents where id = 'f0000000-0000-4000-8000-000000000002';
select throws_ok($$select finance.issue_document('f0000000-0000-4000-8000-000000000002')$$, 'P0002', null, 'Gelöschter Entwurf');
select is(finance.issue_document('f0000000-0000-4000-8000-000000000003', '2026-11-28'), 'RE-2026-0002', 'Nächste Nummer ohne Lücke');

-- Unveränderlichkeit
select throws_ok($$update finance.document_lines set unit_price = 1 where document_id = 'f0000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'Positionen ausgestellter Rechnungen sind gesperrt');
select throws_ok($$insert into finance.document_lines (tenant_id, document_id, title) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000001', 'Nachtrag')$$, '23514', null, 'Keine neuen Positionen');
select throws_ok($$update finance.documents set recipient_name = 'Andere' where id = 'f0000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'Empfänger gesperrt');
delete from finance.documents where id = 'f0000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select throws_ok($$delete from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'$$, '23514', null,
  'Ausgestellte Rechnungen werden nicht gelöscht (auch nicht ohne RLS)');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 1, 'Rechnung ist noch da');

-- Zahlungen
select finance.record_payment('f0000000-0000-4000-8000-000000000001', 100, '2026-11-30');
select is((select array[status, paid_total::text] from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'),
  array['partially_paid', '100.00'], 'Teilzahlung');
select finance.record_payment('f0000000-0000-4000-8000-000000000001', 186.15, '2026-12-02', 'transfer', 'Rest');
select is((select status from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 'paid', 'Bezahlt');

-- Storno
select throws_ok($$select finance.cancel_invoice('f0000000-0000-4000-8000-000000000001', '')$$, '22023', null, 'Storno braucht einen Grund');
create temp table storno as select finance.cancel_invoice('f0000000-0000-4000-8000-000000000001', 'Doppelt berechnet') as id;
select is((select array[number, status] from finance.documents where id = (select id from storno)), array['GS-2026-0001', 'issued'],
  'Stornorechnung mit eigener Nummer');
select is((select gross_total from finance.documents where id = (select id from storno)), -286.15, 'mit negativen Beträgen');
select is((select status from finance.documents where id = 'f0000000-0000-4000-8000-000000000001'), 'cancelled', 'Original ist storniert');
select throws_ok($$select finance.cancel_invoice('f0000000-0000-4000-8000-000000000001', 'nochmal')$$, '22023', null, 'Nur einmal stornieren');
select pg_temp.logout();

-- Angebote -----------------------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into finance.documents (id, tenant_id, kind, customer_id, title) values
  ('f0000000-0000-4000-8000-0000000000a1', '11111111-0000-4000-8000-00000000000a', 'quote', 'c5000000-0000-4000-8000-000000000001', 'Relaunch');
insert into finance.document_lines (tenant_id, document_id, title, quantity, unit_price) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000a1', 'Design', 10, 90);
select is(finance.issue_document('f0000000-0000-4000-8000-0000000000a1', '2026-11-28'), 'AN-2026-0001', 'Mitglied verschickt Angebote');
select is((select valid_until from finance.documents where id = 'f0000000-0000-4000-8000-0000000000a1'), '2026-12-28'::date, 'Gültig 30 Tage');
create temp table converted as select finance.quote_to_invoice('f0000000-0000-4000-8000-0000000000a1') as id;
select is((select array[kind, status, gross_total::text] from finance.documents where id = (select id from converted)),
  array['invoice', 'draft', '1071.00'], 'Angebot wird Rechnungsentwurf mit gleichen Positionen');
select is((select status from finance.documents where id = 'f0000000-0000-4000-8000-0000000000a1'), 'accepted', 'Angebot ist angenommen');
select is((select open_count from finance.overview('11111111-0000-4000-8000-00000000000a', '2026-11-01')), 1, 'Übersicht: eine offene Rechnung');
select pg_temp.logout();

-- Kleinunternehmer: keine Umsatzsteuer
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
update finance.settings set small_business = true where tenant_id = '11111111-0000-4000-8000-00000000000a';
insert into finance.documents (id, tenant_id, kind, customer_id) values
  ('f0000000-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-00000000000a', 'invoice', 'c5000000-0000-4000-8000-000000000001');
insert into finance.document_lines (tenant_id, document_id, title, quantity, unit_price, tax_rate) values
  ('11111111-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000b1', 'Beratung', 1, 100, 19);
select is((select array[tax_total, gross_total] from finance.documents where id = 'f0000000-0000-4000-8000-0000000000b1'),
  array[0, 100]::numeric[], 'Kleinunternehmerregelung: keine Umsatzsteuer');
select pg_temp.logout();

select is((select count(*)::int from core.audit_logs where tenant_id = '11111111-0000-4000-8000-00000000000a' and action = 'finance.documents.status'), 8,
  'Ausstellen, Zahlungen und Storno stehen im Protokoll');
select is((select count(*)::int from core.audit_logs where tenant_id = '11111111-0000-4000-8000-00000000000a' and action = 'finance.payments.insert'), 2,
  'Zahlungen stehen im Protokoll');
select is((select count(*)::int from core.search_index where entity_type = 'finance_document' and tenant_id = '11111111-0000-4000-8000-00000000000a'), 4,
  'Ausgestellte Belege sind suchbar, Entwürfe nicht');

-- Betrachter und fremde Unternehmen ----------------------------------------------------------
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from finance.documents), 0, 'Betrachter sehen keine Finanzen');
select pg_temp.logout();
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from finance.documents), 0, 'Fremde Belege unsichtbar');
select throws_ok($$select finance.record_payment('f0000000-0000-4000-8000-000000000003', 10, '2026-12-01')$$, 'P0002', null,
  'Keine Zahlungen zu fremden Rechnungen');
select throws_ok($$insert into finance.documents (tenant_id, kind) values ('11111111-0000-4000-8000-00000000000a', 'invoice')$$, '42501', null,
  'Keine Belege in fremden Unternehmen');
select pg_temp.logout();

select * from finish();
rollback;
