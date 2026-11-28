-- =============================================================================
-- NOVA Finanzen – Angebote, Rechnungen, Gutschriften/Storno, Zahlungen, Artikel,
-- Rechnungseinstellungen (Plattform-Phase 3a)
-- -----------------------------------------------------------------------------
-- Grundsätze (GoBD, § 14 UStG)
--   * Belege entstehen als Entwurf. Mit dem Ausstellen erhalten sie eine lückenlose,
--     fortlaufende Nummer je Art und Jahr (RE-2026-0001) und werden unveränderlich:
--     Positionen, Beträge, Empfänger- und Absenderdaten sind eingefroren.
--   * Ausgestellte Rechnungen werden nie gelöscht oder überschrieben, sondern per
--     Stornorechnung (Gutschrift mit negativen Beträgen, Verweis auf das Original)
--     aufgehoben.
--   * Beträge: Position netto = Menge × Einzelpreis − Rabatt (kaufmännisch gerundet);
--     Umsatzsteuer je Steuersatz auf die Summe der Netto-Positionen.
-- =============================================================================

update core.modules set status = 'available', enabled_by_default = true where key = 'finance';

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('finance.view',   'finance', 'Finanzen ansehen',       'Angebote, Rechnungen, Gutschriften, Zahlungen und Übersicht.',               'member', true, false, 10),
  ('finance.edit',   'finance', 'Belege bearbeiten',       'Angebote und Rechnungsentwürfe anlegen und ändern, Artikel pflegen.',         'member', true, false, 20),
  ('finance.issue',  'finance', 'Rechnungen ausstellen',   'Belege verbindlich ausstellen, stornieren und Zahlungen erfassen.',           'admin',  true, true,  30),
  ('finance.manage', 'finance', 'Finanzen verwalten',     'Rechnungsdaten des Unternehmens, Nummernkreise und Zahlungsbedingungen.',     'admin',  true, false, 40);

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table finance.settings (
  tenant_id          uuid primary key references core.tenants(id) on delete cascade,
  legal_name         text check (char_length(legal_name) <= 200),
  street             text check (char_length(street) <= 200),
  postal_code        text check (char_length(postal_code) <= 20),
  city               text check (char_length(city) <= 120),
  country_code       char(2) not null default 'DE' check (country_code ~ '^[A-Z]{2}$'),
  email              text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone              text check (char_length(phone) <= 50),
  website            text check (char_length(website) <= 200),
  vat_id             text check (char_length(vat_id) <= 30),
  tax_number         text check (char_length(tax_number) <= 30),
  register_info      text check (char_length(register_info) <= 200),
  managing_directors text check (char_length(managing_directors) <= 200),
  bank_name          text check (char_length(bank_name) <= 120),
  iban               text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  bic                text check (bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 365),
  quote_valid_days   integer not null default 30 check (quote_valid_days between 1 and 365),
  default_tax_rate   numeric(5, 2) not null default 19 check (default_tax_rate between 0 and 100),
  small_business     boolean not null default false,  -- Kleinunternehmerregelung § 19 UStG
  invoice_footer     text check (char_length(invoice_footer) <= 1000),
  updated_at         timestamptz not null default now()
);

create table finance.number_sequences (
  tenant_id  uuid not null references core.tenants(id) on delete cascade,
  kind       text not null check (kind in ('quote', 'invoice', 'credit_note')),
  year       integer not null,
  next_value integer not null default 1,
  primary key (tenant_id, kind, year)
);

create table finance.articles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references core.tenants(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  unit        text not null default 'Stück' check (char_length(btrim(unit)) between 1 and 20),
  unit_price  numeric(14, 2) not null default 0 check (unit_price between -100000000 and 100000000),
  tax_rate    numeric(5, 2) not null default 19 check (tax_rate between 0 and 100),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id)
);
create index articles_tenant_name_idx on finance.articles (tenant_id, lower(name)) where archived_at is null;

create table finance.documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references core.tenants(id) on delete cascade,
  kind                text not null check (kind in ('quote', 'invoice', 'credit_note')),
  number              text,
  status              text not null default 'draft'
                      check (status in ('draft', 'sent', 'accepted', 'rejected', 'issued', 'partially_paid', 'paid', 'cancelled')),
  customer_id         uuid,
  project_id          uuid,
  quote_id            uuid,  -- Rechnung aus Angebot
  cancels_id          uuid,  -- Stornorechnung zu dieser Rechnung
  title               text check (char_length(title) <= 200),
  intro_text          text check (char_length(intro_text) <= 2000),
  closing_text        text check (char_length(closing_text) <= 2000),
  recipient_name      text check (char_length(recipient_name) <= 200),
  recipient_extra     text check (char_length(recipient_extra) <= 200),
  recipient_street    text check (char_length(recipient_street) <= 200),
  recipient_postal    text check (char_length(recipient_postal) <= 20),
  recipient_city      text check (char_length(recipient_city) <= 120),
  recipient_country   char(2) not null default 'DE' check (recipient_country ~ '^[A-Z]{2}$'),
  recipient_vat_id    text check (char_length(recipient_vat_id) <= 30),
  issue_date          date,
  service_date        date,
  service_end_date    date,
  due_date            date,
  valid_until         date,
  currency            char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  net_total           numeric(14, 2) not null default 0,
  tax_total           numeric(14, 2) not null default 0,
  gross_total         numeric(14, 2) not null default 0,
  tax_breakdown       jsonb not null default '[]',
  paid_total          numeric(14, 2) not null default 0,
  seller              jsonb,  -- eingefrorene Absenderdaten beim Ausstellen
  small_business      boolean not null default false,
  cancel_reason       text check (char_length(cancel_reason) <= 500),
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  issued_at           timestamptz,
  issued_by           uuid references auth.users(id) on delete set null,
  unique (tenant_id, id),
  unique (tenant_id, number),
  check (service_end_date is null or service_date is null or service_end_date >= service_date),
  check ((status = 'draft') = (number is null)),
  check (kind = 'quote' or status not in ('sent', 'accepted', 'rejected')),
  check (kind <> 'quote' or status not in ('issued', 'partially_paid', 'paid')),
  foreign key (tenant_id, customer_id) references crm.customers(tenant_id, id) on delete restrict,
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete set null (project_id),
  foreign key (tenant_id, quote_id) references finance.documents(tenant_id, id) on delete set null (quote_id),
  foreign key (tenant_id, cancels_id) references finance.documents(tenant_id, id) on delete restrict
);
create index documents_tenant_kind_idx on finance.documents (tenant_id, kind, status, issue_date desc);
create index documents_customer_idx on finance.documents (tenant_id, customer_id);
create index documents_project_idx on finance.documents (tenant_id, project_id) where project_id is not null;
create index documents_quote_idx on finance.documents (tenant_id, quote_id) where quote_id is not null;
create index documents_cancels_idx on finance.documents (tenant_id, cancels_id) where cancels_id is not null;
create index documents_created_by_idx on finance.documents (created_by);
create index documents_issued_by_idx on finance.documents (issued_by);

create table finance.document_lines (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  document_id      uuid not null,
  position         integer not null default 0,
  title            text not null check (char_length(btrim(title)) between 1 and 300),
  description      text check (char_length(description) <= 2000),
  quantity         numeric(12, 3) not null default 1 check (quantity between -1000000 and 1000000),
  unit             text not null default 'Stück' check (char_length(btrim(unit)) between 1 and 20),
  unit_price       numeric(14, 2) not null default 0 check (unit_price between -100000000 and 100000000),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent between 0 and 100),
  tax_rate         numeric(5, 2) not null default 19 check (tax_rate between 0 and 100),
  line_net         numeric(14, 2) generated always as (
                     round(quantity * unit_price * (1 - discount_percent / 100), 2)
                   ) stored,
  article_id       uuid,
  created_at       timestamptz not null default now(),
  foreign key (tenant_id, document_id) references finance.documents(tenant_id, id) on delete cascade,
  foreign key (tenant_id, article_id) references finance.articles(tenant_id, id) on delete set null (article_id)
);
create index document_lines_document_idx on finance.document_lines (tenant_id, document_id, position);
create index document_lines_article_idx on finance.document_lines (tenant_id, article_id) where article_id is not null;

create table finance.payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  document_id uuid not null,
  paid_on     date not null,
  amount      numeric(14, 2) not null check (amount <> 0 and amount between -100000000 and 100000000),
  method      text not null default 'transfer' check (method in ('transfer', 'cash', 'card', 'direct_debit', 'paypal', 'other')),
  note        text check (char_length(note) <= 500),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, document_id) references finance.documents(tenant_id, id) on delete restrict
);
create index payments_document_idx on finance.payments (tenant_id, document_id, paid_on);
create index payments_tenant_date_idx on finance.payments (tenant_id, paid_on);
create index payments_created_by_idx on finance.payments (created_by);

-- -----------------------------------------------------------------------------
-- Summen, Schutz der ausgestellten Belege
-- -----------------------------------------------------------------------------
create or replace function finance.recalc(p_document uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_small boolean;
  v_rows  jsonb;
  v_net   numeric(14, 2);
  v_tax   numeric(14, 2);
begin
  select small_business into v_small from finance.documents where id = p_document;
  select coalesce(jsonb_agg(jsonb_build_object('rate', rate, 'net', net, 'tax', tax) order by rate desc), '[]'),
         coalesce(sum(net), 0), coalesce(sum(tax), 0)
  into v_rows, v_net, v_tax
  from (
    select l.tax_rate as rate, sum(l.line_net) as net,
           case when v_small then 0 else round(sum(l.line_net) * l.tax_rate / 100, 2) end as tax
    from finance.document_lines l where l.document_id = p_document
    group by l.tax_rate
  ) t;
  update finance.documents set net_total = v_net, tax_total = v_tax, gross_total = v_net + v_tax, tax_breakdown = v_rows
  where id = p_document;
end $$;

-- Bewusst ohne SECURITY DEFINER: current_user unterscheidet Nutzer (authenticated) von den Fachfunktionen
create or replace function finance.protect_line()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_doc uuid := coalesce(new.document_id, old.document_id);
  v_status text;
begin
  select status into v_status from finance.documents where id = v_doc;
  if v_status is not null and v_status <> 'draft' and current_user = 'authenticated' then
    raise exception 'Ausgestellte Belege können nicht mehr geändert werden' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id;
    new.document_id := old.document_id;
  end if;
  return coalesce(new, old);
end $$;
create trigger document_lines_protect before insert or update or delete on finance.document_lines
  for each row execute function finance.protect_line();

create or replace function finance.after_line_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from finance.documents where id = coalesce(new.document_id, old.document_id)) then
    perform finance.recalc(coalesce(new.document_id, old.document_id));
  end if;
  return null;
end $$;
create trigger document_lines_recalc after insert or update or delete on finance.document_lines
  for each row execute function finance.after_line_change();

-- Ausgestellte Belege: nur noch Status-, Zahlungs- und Stornofelder (über die Funktionen)
create or replace function finance.protect_document()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and exists (select 1 from core.tenants where id = old.tenant_id) then
      raise exception 'Ausgestellte Belege werden nicht gelöscht, sondern storniert' using errcode = '23514';
    end if;
    return old;
  end if;
  new.tenant_id := old.tenant_id;
  new.kind := old.kind;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if current_user = 'authenticated' then
    -- Status, Nummer und Beträge setzen nur die Funktionen
    new.number := old.number;
    new.status := case when old.kind = 'quote' and old.status in ('sent', 'accepted', 'rejected') and new.status in ('sent', 'accepted', 'rejected')
                       then new.status else old.status end;
    new.paid_total := old.paid_total;
    new.net_total := old.net_total;
    new.tax_total := old.tax_total;
    new.gross_total := old.gross_total;
    new.tax_breakdown := old.tax_breakdown;
    new.seller := old.seller;
    new.issued_at := old.issued_at;
    new.issued_by := old.issued_by;
    new.cancels_id := old.cancels_id;
    if old.status <> 'draft' and (row(new.customer_id, new.title, new.intro_text, new.closing_text, new.recipient_name, new.recipient_extra,
        new.recipient_street, new.recipient_postal, new.recipient_city, new.recipient_country, new.recipient_vat_id, new.issue_date,
        new.service_date, new.service_end_date, new.due_date, new.valid_until, new.currency, new.small_business)
        is distinct from row(old.customer_id, old.title, old.intro_text, old.closing_text, old.recipient_name, old.recipient_extra,
        old.recipient_street, old.recipient_postal, old.recipient_city, old.recipient_country, old.recipient_vat_id, old.issue_date,
        old.service_date, old.service_end_date, old.due_date, old.valid_until, old.currency, old.small_business)) then
      raise exception 'Ausgestellte Belege können nicht mehr geändert werden' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger documents_protect before update or delete on finance.documents
  for each row execute function finance.protect_document();

create trigger documents_updated_at before update on finance.documents for each row execute function core.set_updated_at();
create trigger articles_updated_at before update on finance.articles for each row execute function core.set_updated_at();
create trigger settings_updated_at before update on finance.settings for each row execute function core.set_updated_at();

-- Neuer Entwurf: Kleinunternehmerregelung und Standardtexte aus den Einstellungen
create or replace function finance.prepare_document()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(s.small_business, false) into new.small_business from finance.settings s where s.tenant_id = new.tenant_id;
  new.small_business := coalesce(new.small_business, false);
  return new;
end $$;
create trigger documents_prepare before insert on finance.documents
  for each row execute function finance.prepare_document();

-- -----------------------------------------------------------------------------
-- Fachfunktionen
-- -----------------------------------------------------------------------------
create or replace function finance.next_number(p_tenant uuid, p_kind text, p_year integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_value integer;
begin
  insert into finance.number_sequences as s (tenant_id, kind, year, next_value) values (p_tenant, p_kind, p_year, 2)
  on conflict (tenant_id, kind, year) do update set next_value = s.next_value + 1
  returning s.next_value - 1 into v_value;
  return case p_kind when 'quote' then 'AN' when 'invoice' then 'RE' else 'GS' end || '-' || p_year || '-' || lpad(v_value::text, 4, '0');
end $$;

-- Ausstellen: Pflichtangaben prüfen, Nummer vergeben, Absender und Empfänger einfrieren
create or replace function finance.issue_document(p_document uuid, p_issue_date date default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_doc      finance.documents;
  v_settings finance.settings;
  v_customer record;
  v_date     date;
  v_number   text;
begin
  select * into v_doc from finance.documents where id = p_document for update;
  if not found or not core.can(v_doc.tenant_id, 'finance.view') then
    raise exception 'Beleg nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_doc.tenant_id, case when v_doc.kind = 'quote' then 'finance.edit' else 'finance.issue' end) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_doc.status <> 'draft' then
    raise exception 'Der Beleg ist bereits ausgestellt' using errcode = '22023';
  end if;
  if not exists (select 1 from finance.document_lines where document_id = p_document) then
    raise exception 'Der Beleg hat keine Positionen' using errcode = '22023';
  end if;
  select * into v_settings from finance.settings where tenant_id = v_doc.tenant_id;
  if v_doc.kind <> 'quote' and (v_settings.legal_name is null or v_settings.street is null or v_settings.city is null
                                or (v_settings.vat_id is null and v_settings.tax_number is null)) then
    raise exception 'Bitte zuerst die Rechnungsdaten des Unternehmens vollständig eintragen (Name, Anschrift, Steuernummer oder USt-IdNr.)'
      using errcode = '22023';
  end if;

  -- Empfänger aus dem Kunden übernehmen, soweit nicht im Entwurf angepasst
  if v_doc.customer_id is not null then
    select name, street, postal_code, city, country_code, vat_id into v_customer from crm.customers where id = v_doc.customer_id;
    v_doc.recipient_name := coalesce(v_doc.recipient_name, v_customer.name);
    v_doc.recipient_street := coalesce(v_doc.recipient_street, v_customer.street);
    v_doc.recipient_postal := coalesce(v_doc.recipient_postal, v_customer.postal_code);
    v_doc.recipient_city := coalesce(v_doc.recipient_city, v_customer.city);
    v_doc.recipient_vat_id := coalesce(v_doc.recipient_vat_id, v_customer.vat_id);
    if v_doc.recipient_country = 'DE' and v_customer.country_code is not null then
      v_doc.recipient_country := v_customer.country_code;
    end if;
  end if;
  if v_doc.recipient_name is null then
    raise exception 'Bitte einen Empfänger angeben' using errcode = '22023';
  end if;
  if v_doc.kind = 'invoice' and v_doc.recipient_street is null then
    raise exception 'Bitte die Anschrift des Empfängers angeben' using errcode = '22023';
  end if;

  v_date := coalesce(p_issue_date, v_doc.issue_date, (now() at time zone (select timezone from core.tenants where id = v_doc.tenant_id))::date);
  v_number := finance.next_number(v_doc.tenant_id, v_doc.kind, extract(year from v_date)::integer);
  update finance.documents set
    number = v_number,
    status = case when kind = 'quote' then 'sent' else 'issued' end,
    issue_date = v_date,
    service_date = case when kind = 'invoice' then coalesce(service_date, v_date) else service_date end,
    due_date = case when kind = 'invoice' then coalesce(due_date, v_date + coalesce(v_settings.payment_terms_days, 14)) else due_date end,
    valid_until = case when kind = 'quote' then coalesce(valid_until, v_date + coalesce(v_settings.quote_valid_days, 30)) else valid_until end,
    recipient_name = v_doc.recipient_name,
    recipient_street = v_doc.recipient_street,
    recipient_postal = v_doc.recipient_postal,
    recipient_city = v_doc.recipient_city,
    recipient_country = v_doc.recipient_country,
    recipient_vat_id = v_doc.recipient_vat_id,
    seller = to_jsonb(v_settings) - 'tenant_id' - 'updated_at',
    issued_at = now(),
    issued_by = (select auth.uid())
  where id = p_document;
  perform finance.recalc(p_document);
  return v_number;
end $$;

-- Storno: Gutschrift mit negativen Positionen, sofort ausgestellt; Original wird „storniert“
create or replace function finance.cancel_invoice(p_invoice uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv finance.documents;
  v_id  uuid;
begin
  select * into v_inv from finance.documents where id = p_invoice for update;
  if not found or not core.can(v_inv.tenant_id, 'finance.view') then
    raise exception 'Beleg nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_inv.tenant_id, 'finance.issue') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_inv.kind <> 'invoice' or v_inv.status not in ('issued', 'partially_paid', 'paid') then
    raise exception 'Nur ausgestellte Rechnungen können storniert werden' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Bitte einen Grund für das Storno angeben' using errcode = '22023';
  end if;

  insert into finance.documents (tenant_id, kind, customer_id, project_id, cancels_id, title, intro_text,
    recipient_name, recipient_extra, recipient_street, recipient_postal, recipient_city, recipient_country, recipient_vat_id,
    service_date, service_end_date, currency, cancel_reason)
  values (v_inv.tenant_id, 'credit_note', v_inv.customer_id, v_inv.project_id, v_inv.id,
    'Stornorechnung zu ' || v_inv.number, 'Hiermit stornieren wir die Rechnung ' || v_inv.number || ' vom ' || to_char(v_inv.issue_date, 'DD.MM.YYYY') || '.',
    v_inv.recipient_name, v_inv.recipient_extra, v_inv.recipient_street, v_inv.recipient_postal, v_inv.recipient_city,
    v_inv.recipient_country, v_inv.recipient_vat_id, v_inv.service_date, v_inv.service_end_date, v_inv.currency, btrim(p_reason))
  returning id into v_id;
  update finance.documents set small_business = v_inv.small_business where id = v_id;
  insert into finance.document_lines (tenant_id, document_id, position, title, description, quantity, unit, unit_price, discount_percent, tax_rate)
  select tenant_id, v_id, position, title, description, -quantity, unit, unit_price, discount_percent, tax_rate
  from finance.document_lines where document_id = v_inv.id;
  perform finance.issue_document(v_id);
  update finance.documents set status = 'cancelled', cancel_reason = btrim(p_reason) where id = v_inv.id;
  return v_id;
end $$;

-- Zahlung erfassen; Status ergibt sich aus der Summe
create or replace function finance.record_payment(p_document uuid, p_amount numeric, p_paid_on date, p_method text default 'transfer', p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_doc finance.documents;
  v_id  uuid;
begin
  select * into v_doc from finance.documents where id = p_document for update;
  if not found or not core.can(v_doc.tenant_id, 'finance.view') then
    raise exception 'Beleg nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_doc.tenant_id, 'finance.issue') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_doc.kind <> 'invoice' or v_doc.status not in ('issued', 'partially_paid', 'paid') then
    raise exception 'Zahlungen nur zu offenen Rechnungen' using errcode = '22023';
  end if;
  insert into finance.payments (tenant_id, document_id, paid_on, amount, method, note)
  values (v_doc.tenant_id, p_document, p_paid_on, round(p_amount, 2), p_method, nullif(btrim(p_note), ''))
  returning id into v_id;
  perform finance.sync_payment_status(p_document);
  return v_id;
end $$;

create or replace function finance.delete_payment(p_payment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_doc uuid;
  v_tenant uuid;
begin
  select document_id, tenant_id into v_doc, v_tenant from finance.payments where id = p_payment;
  if not found or not core.can(v_tenant, 'finance.issue') then
    raise exception 'Zahlung nicht gefunden' using errcode = 'P0002';
  end if;
  if (select status from finance.documents where id = v_doc) = 'cancelled' then
    raise exception 'Zahlungen stornierter Rechnungen bleiben erhalten' using errcode = '22023';
  end if;
  delete from finance.payments where id = p_payment;
  perform finance.sync_payment_status(v_doc);
end $$;

create or replace function finance.sync_payment_status(p_document uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_paid numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_paid from finance.payments where document_id = p_document;
  update finance.documents set
    paid_total = v_paid,
    status = case when status = 'cancelled' then status
                  when v_paid >= gross_total and gross_total > 0 then 'paid'
                  when v_paid > 0 then 'partially_paid'
                  else 'issued' end
  where id = p_document;
end $$;

-- Angebot in Rechnungsentwurf übernehmen
create or replace function finance.quote_to_invoice(p_quote uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_quote finance.documents;
  v_id    uuid;
begin
  select * into v_quote from finance.documents where id = p_quote;
  if not found or not core.can(v_quote.tenant_id, 'finance.view') then
    raise exception 'Angebot nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_quote.tenant_id, 'finance.edit') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_quote.kind <> 'quote' or v_quote.status not in ('sent', 'accepted') then
    raise exception 'Nur versendete oder angenommene Angebote lassen sich übernehmen' using errcode = '22023';
  end if;
  insert into finance.documents (tenant_id, kind, customer_id, project_id, quote_id, title, intro_text, closing_text,
    recipient_name, recipient_extra, recipient_street, recipient_postal, recipient_city, recipient_country, recipient_vat_id, currency, created_by)
  values (v_quote.tenant_id, 'invoice', v_quote.customer_id, v_quote.project_id, v_quote.id, v_quote.title,
    'Vielen Dank für Ihren Auftrag zu unserem Angebot ' || v_quote.number || '.', v_quote.closing_text,
    v_quote.recipient_name, v_quote.recipient_extra, v_quote.recipient_street, v_quote.recipient_postal, v_quote.recipient_city,
    v_quote.recipient_country, v_quote.recipient_vat_id, v_quote.currency, (select auth.uid()))
  returning id into v_id;
  insert into finance.document_lines (tenant_id, document_id, position, title, description, quantity, unit, unit_price, discount_percent, tax_rate, article_id)
  select tenant_id, v_id, position, title, description, quantity, unit, unit_price, discount_percent, tax_rate, article_id
  from finance.document_lines where document_id = v_quote.id;
  update finance.documents set status = 'accepted' where id = v_quote.id;
  return v_id;
end $$;

-- Übersicht: offene Posten, Überfälliges, Zahlungseingang im Monat, offene Angebote
create or replace function finance.overview(p_tenant uuid, p_month_start date)
returns table (open_count integer, open_total numeric, overdue_count integer, overdue_total numeric,
               paid_month numeric, issued_month numeric, quotes_open integer, quotes_open_total numeric)
language sql stable security invoker set search_path = '' as $$
  with today as (select (now() at time zone (select timezone from core.tenants where id = p_tenant))::date as d)
  select
    count(*) filter (where d.kind = 'invoice' and d.status in ('issued', 'partially_paid'))::integer,
    coalesce(sum(d.gross_total - d.paid_total) filter (where d.kind = 'invoice' and d.status in ('issued', 'partially_paid')), 0),
    count(*) filter (where d.kind = 'invoice' and d.status in ('issued', 'partially_paid') and d.due_date < (select d from today))::integer,
    coalesce(sum(d.gross_total - d.paid_total) filter (where d.kind = 'invoice' and d.status in ('issued', 'partially_paid') and d.due_date < (select d from today)), 0),
    coalesce((select sum(p.amount) from finance.payments p where p.tenant_id = p_tenant and p.paid_on >= p_month_start), 0),
    coalesce(sum(d.net_total) filter (where d.kind in ('invoice', 'credit_note') and d.status <> 'draft' and d.issue_date >= p_month_start), 0),
    count(*) filter (where d.kind = 'quote' and d.status = 'sent')::integer,
    coalesce(sum(d.gross_total) filter (where d.kind = 'quote' and d.status = 'sent'), 0)
  from finance.documents d
  where d.tenant_id = p_tenant;
$$;

-- -----------------------------------------------------------------------------
-- Protokoll, Suche
-- -----------------------------------------------------------------------------
create or replace function finance.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_doc finance.documents;
begin
  if not exists (select 1 from core.tenants where id = (v_row ->> 'tenant_id')::uuid) then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'documents' then
    -- Entwürfe: nur Anlegen/Löschen; danach jede Statusänderung
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then
      return new;
    end if;
    perform core.log_audit(new.tenant_id, 'finance.documents.' || case when tg_op = 'UPDATE' then 'status' else lower(tg_op) end,
      'documents', coalesce(new.id, old.id)::text,
      jsonb_strip_nulls(jsonb_build_object('kind', coalesce(new.kind, old.kind), 'number', coalesce(new.number, old.number),
        'status', coalesce(new.status, old.status), 'gross', coalesce(new.gross_total, old.gross_total)::text)));
  elsif tg_table_name = 'payments' then
    select * into v_doc from finance.documents where id = (v_row ->> 'document_id')::uuid;
    perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'finance.payments.' || lower(tg_op), 'payments', v_row ->> 'id',
      jsonb_build_object('number', v_doc.number, 'amount', v_row ->> 'amount'));
  elsif tg_table_name = 'settings' then
    perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'finance.settings.' || lower(tg_op), 'settings', null, '{}');
  end if;
  return coalesce(new, old);
end $$;
create trigger documents_audit after insert or update or delete on finance.documents
  for each row execute function finance.write_audit_log();
create trigger payments_audit after insert or delete on finance.payments
  for each row execute function finance.write_audit_log();
create trigger settings_audit after insert or update on finance.settings
  for each row execute function finance.write_audit_log();

create or replace function finance.search_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform core.search_remove('finance_document', old.id);
    return old;
  end if;
  if new.number is null then
    perform core.search_remove('finance_document', new.id);
  else
    perform core.search_upsert(new.tenant_id, 'finance_document', new.id,
      case new.kind when 'quote' then 'Angebot ' when 'invoice' then 'Rechnung ' else 'Gutschrift ' end || new.number,
      concat_ws(' · ', new.recipient_name, new.title), 'finanzen/belege/' || new.id, 'finance.view');
  end if;
  return new;
end $$;
create trigger documents_search after insert or update of number, recipient_name, title or delete on finance.documents
  for each row execute function finance.search_sync();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table finance.settings enable row level security;
alter table finance.number_sequences enable row level security;
alter table finance.articles enable row level security;
alter table finance.documents enable row level security;
alter table finance.document_lines enable row level security;
alter table finance.payments enable row level security;

create policy settings_select on finance.settings for select to authenticated using (core.can(tenant_id, 'finance.view'));
create policy settings_insert on finance.settings for insert to authenticated with check (core.can(tenant_id, 'finance.manage'));
create policy settings_update on finance.settings for update to authenticated
  using (core.can(tenant_id, 'finance.manage')) with check (core.can(tenant_id, 'finance.manage'));

create policy articles_select on finance.articles for select to authenticated using (core.can(tenant_id, 'finance.view'));
create policy articles_insert on finance.articles for insert to authenticated with check (core.can(tenant_id, 'finance.edit'));
create policy articles_update on finance.articles for update to authenticated
  using (core.can(tenant_id, 'finance.edit')) with check (core.can(tenant_id, 'finance.edit'));

create policy documents_select on finance.documents for select to authenticated using (core.can(tenant_id, 'finance.view'));
create policy documents_insert on finance.documents for insert to authenticated
  with check (core.can(tenant_id, 'finance.edit') and status = 'draft' and number is null and created_by = (select auth.uid())
              and kind in ('quote', 'invoice'));
create policy documents_update on finance.documents for update to authenticated
  using (core.can(tenant_id, 'finance.edit')) with check (core.can(tenant_id, 'finance.edit'));
create policy documents_delete on finance.documents for delete to authenticated using (core.can(tenant_id, 'finance.edit') and status = 'draft');

create policy lines_select on finance.document_lines for select to authenticated using (core.can(tenant_id, 'finance.view'));
create policy lines_insert on finance.document_lines for insert to authenticated with check (core.can(tenant_id, 'finance.edit'));
create policy lines_update on finance.document_lines for update to authenticated
  using (core.can(tenant_id, 'finance.edit')) with check (core.can(tenant_id, 'finance.edit'));
create policy lines_delete on finance.document_lines for delete to authenticated using (core.can(tenant_id, 'finance.edit'));

create policy payments_select on finance.payments for select to authenticated using (core.can(tenant_id, 'finance.view'));

-- =============================================================================
-- Rechte
-- =============================================================================
grant select, insert, update on finance.settings, finance.articles to authenticated;
grant select, insert, update, delete on finance.documents, finance.document_lines to authenticated;
grant select on finance.payments to authenticated;
grant all on all tables in schema finance to service_role;

revoke all on function finance.recalc(uuid), finance.protect_line(), finance.after_line_change(), finance.protect_document(),
  finance.prepare_document(), finance.next_number(uuid, text, integer), finance.sync_payment_status(uuid),
  finance.write_audit_log(), finance.search_sync() from public, anon, authenticated;
revoke all on function finance.issue_document(uuid, date), finance.cancel_invoice(uuid, text),
  finance.record_payment(uuid, numeric, date, text, text), finance.delete_payment(uuid), finance.quote_to_invoice(uuid),
  finance.overview(uuid, date) from public, anon;
grant execute on function finance.issue_document(uuid, date), finance.cancel_invoice(uuid, text),
  finance.record_payment(uuid, numeric, date, text, text), finance.delete_payment(uuid), finance.quote_to_invoice(uuid),
  finance.overview(uuid, date) to authenticated;

insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select id, 'finance', true, 'included' from core.tenants
on conflict (tenant_id, module_key) do nothing;
