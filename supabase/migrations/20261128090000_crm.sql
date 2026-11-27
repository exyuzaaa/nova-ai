-- =============================================================================
-- NOVA CRM – Kunden, Ansprechpartner, Leads, Pipelines, Verkaufschancen,
-- Aktivitäten (Plattform-Phase 2a)
-- -----------------------------------------------------------------------------
-- Grundsätze
--   * Jede Zeile trägt tenant_id; Verweise laufen über (tenant_id, id) – ein
--     Datensatz kann technisch nicht auf ein fremdes Unternehmen zeigen.
--   * RLS mit core.can(): crm.view (Lesen), crm.edit (Anlegen/Ändern),
--     crm.manage (Löschen, Pipelines). Modul aus → keine Daten.
--   * Nummernkreise je Unternehmen: K-00001 (Kunden), L-00001 (Leads),
--     V-00001 (Verkaufschancen).
--   * Suche, Protokoll, Benachrichtigungen und Wiedervorlagen über den Kern.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Modul und Rechte
-- -----------------------------------------------------------------------------
update core.modules set status = 'available', enabled_by_default = true where key = 'crm';

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('crm.view',   'crm', 'CRM ansehen',     'Kunden, Ansprechpartner, Leads, Verkaufschancen und Aktivitäten.', 'viewer', true, false, 10),
  ('crm.edit',   'crm', 'CRM bearbeiten',  'Kunden, Leads, Verkaufschancen und Aktivitäten anlegen und ändern.', 'member', true, false, 20),
  ('crm.export', 'crm', 'CRM exportieren', 'Kunden und Leads als CSV herunterladen.',                         'member', true, true,  30),
  ('crm.manage', 'crm', 'CRM verwalten',   'Pipelines einrichten, importieren und Datensätze löschen.',       'admin',  true, false, 40);

-- -----------------------------------------------------------------------------
-- Nummernkreise
-- -----------------------------------------------------------------------------
create table crm.number_sequences (
  tenant_id  uuid not null references core.tenants(id) on delete cascade,
  kind       text not null check (kind in ('customer', 'lead', 'opportunity')),
  next_value bigint not null default 1 check (next_value > 0),
  primary key (tenant_id, kind)
);

create or replace function crm.next_number(p_tenant uuid, p_kind text, p_prefix text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_value bigint;
begin
  insert into crm.number_sequences as s (tenant_id, kind, next_value) values (p_tenant, p_kind, 2)
  on conflict (tenant_id, kind) do update set next_value = s.next_value + 1
  returning s.next_value - 1 into v_value;
  return p_prefix || lpad(v_value::text, 5, '0');
end $$;

-- -----------------------------------------------------------------------------
-- Kunden und Ansprechpartner
-- -----------------------------------------------------------------------------
create table crm.customers (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references core.tenants(id) on delete cascade,
  number          text not null default '',  -- vergibt crm.assign_number()
  kind            text not null default 'company' check (kind in ('company', 'person')),
  name            text not null check (char_length(btrim(name)) between 1 and 200),
  email           text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text check (char_length(phone) <= 50),
  website         text check (char_length(website) <= 200),
  vat_id          text check (char_length(vat_id) <= 30),
  street          text check (char_length(street) <= 200),
  postal_code     text check (char_length(postal_code) <= 20),
  city            text check (char_length(city) <= 120),
  country_code    char(2) not null default 'DE' check (country_code ~ '^[A-Z]{2}$'),
  status          text not null default 'active' check (status in ('prospect', 'active', 'inactive')),
  category        text check (char_length(category) <= 80),
  tags            text[] not null default '{}' check (cardinality(tags) <= 20),
  description     text check (char_length(description) <= 5000),
  owner_member_id uuid,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, number),
  foreign key (tenant_id, owner_member_id) references core.tenant_members(tenant_id, id) on delete set null (owner_member_id)
);
create index customers_tenant_name_idx on crm.customers (tenant_id, lower(name));
create index customers_tenant_email_idx on crm.customers (tenant_id, lower(email)) where email is not null;
create index customers_tenant_owner_idx on crm.customers (tenant_id, owner_member_id);
create index customers_name_trgm_idx on crm.customers using gin (lower(name) extensions.gin_trgm_ops);
create index customers_tags_idx on crm.customers using gin (tags);
create index customers_created_by_idx on crm.customers (created_by);

create table crm.contacts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references core.tenants(id) on delete cascade,
  customer_id uuid not null,
  first_name  text check (char_length(first_name) <= 100),
  last_name   text check (char_length(last_name) <= 100),
  position    text check (char_length(position) <= 120),
  email       text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (char_length(phone) <= 50),
  is_primary  boolean not null default false,
  notes       text check (char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id),
  check (coalesce(btrim(first_name), '') <> '' or coalesce(btrim(last_name), '') <> ''),
  foreign key (tenant_id, customer_id) references crm.customers(tenant_id, id) on delete cascade
);
create index contacts_tenant_customer_idx on crm.contacts (tenant_id, customer_id);
create unique index contacts_one_primary_idx on crm.contacts (customer_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Leads
-- -----------------------------------------------------------------------------
create table crm.leads (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references core.tenants(id) on delete cascade,
  number                text not null default '',  -- vergibt crm.assign_number()
  title                 text not null check (char_length(btrim(title)) between 1 and 200),
  company_name          text check (char_length(company_name) <= 200),
  contact_name          text check (char_length(contact_name) <= 200),
  email                 text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                 text check (char_length(phone) <= 50),
  source                text not null default 'other'
                          check (source in ('website', 'referral', 'event', 'cold_call', 'campaign', 'social', 'partner', 'other')),
  status                text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  score                 smallint not null default 0 check (score between 0 and 100),
  estimated_value       numeric(14, 2) check (estimated_value >= 0),
  owner_member_id       uuid,
  follow_up_at          timestamptz,
  follow_up_notified_at timestamptz,
  notes                 text check (char_length(notes) <= 5000),
  converted_customer_id uuid,
  converted_at          timestamptz,
  created_by            uuid references auth.users(id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, number),
  check ((status = 'converted') = (converted_at is not null)),
  foreign key (tenant_id, owner_member_id) references core.tenant_members(tenant_id, id) on delete set null (owner_member_id),
  foreign key (tenant_id, converted_customer_id) references crm.customers(tenant_id, id) on delete set null (converted_customer_id)
);
create index leads_tenant_status_idx on crm.leads (tenant_id, status);
create index leads_tenant_owner_idx on crm.leads (tenant_id, owner_member_id);
create index leads_tenant_customer_idx on crm.leads (tenant_id, converted_customer_id);
create index leads_follow_up_idx on crm.leads (follow_up_at) where follow_up_notified_at is null and status not in ('converted', 'unqualified');
create index leads_created_by_idx on crm.leads (created_by);

-- -----------------------------------------------------------------------------
-- Pipelines, Phasen, Verkaufschancen
-- -----------------------------------------------------------------------------
create table crm.pipelines (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references core.tenants(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  is_default boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index pipelines_one_default_idx on crm.pipelines (tenant_id) where is_default;
create unique index pipelines_tenant_name_idx on crm.pipelines (tenant_id, lower(name));

create table crm.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  pipeline_id uuid not null,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  position    integer not null default 0,
  probability smallint not null default 0 check (probability between 0 and 100),
  kind        text not null default 'open' check (kind in ('open', 'won', 'lost')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, pipeline_id, id),
  foreign key (tenant_id, pipeline_id) references crm.pipelines(tenant_id, id) on delete cascade
);
create index pipeline_stages_pipeline_idx on crm.pipeline_stages (tenant_id, pipeline_id, position);

create table crm.opportunities (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references core.tenants(id) on delete cascade,
  number              text not null default '',  -- vergibt crm.assign_number()
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  customer_id         uuid not null,
  pipeline_id         uuid not null,
  stage_id            uuid not null,
  amount              numeric(14, 2) not null default 0 check (amount >= 0),
  currency            char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  probability         smallint check (probability between 0 and 100),
  expected_close_date date,
  owner_member_id     uuid,
  lead_id             uuid,
  closed_at           timestamptz,
  lost_reason         text check (char_length(lost_reason) <= 500),
  notes               text check (char_length(notes) <= 5000),
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, number),
  foreign key (tenant_id, customer_id) references crm.customers(tenant_id, id) on delete cascade,
  -- Phase muss zur Pipeline gehören
  foreign key (tenant_id, pipeline_id, stage_id) references crm.pipeline_stages(tenant_id, pipeline_id, id),
  foreign key (tenant_id, owner_member_id) references core.tenant_members(tenant_id, id) on delete set null (owner_member_id),
  foreign key (tenant_id, lead_id) references crm.leads(tenant_id, id) on delete set null (lead_id)
);
create index opportunities_tenant_customer_idx on crm.opportunities (tenant_id, customer_id);
create index opportunities_tenant_stage_idx on crm.opportunities (tenant_id, pipeline_id, stage_id);
create index opportunities_tenant_owner_idx on crm.opportunities (tenant_id, owner_member_id);
create index opportunities_tenant_lead_idx on crm.opportunities (tenant_id, lead_id);
create index opportunities_created_by_idx on crm.opportunities (created_by);

-- -----------------------------------------------------------------------------
-- Aktivitäten (Notizen, Anrufe, Termine, E-Mails, Aufgaben mit Fälligkeit)
-- -----------------------------------------------------------------------------
create table crm.activities (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references core.tenants(id) on delete cascade,
  kind                 text not null default 'note' check (kind in ('note', 'call', 'meeting', 'email', 'task')),
  subject              text not null check (char_length(btrim(subject)) between 1 and 200),
  body                 text check (char_length(body) <= 10000),
  customer_id          uuid,
  contact_id           uuid,
  lead_id              uuid,
  opportunity_id       uuid,
  due_at               timestamptz,
  done_at              timestamptz,
  assigned_member_id   uuid,
  reminder_notified_at timestamptz,
  created_by           uuid references auth.users(id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, id),
  check (num_nonnulls(customer_id, lead_id, opportunity_id) >= 1),
  foreign key (tenant_id, customer_id) references crm.customers(tenant_id, id) on delete cascade,
  foreign key (tenant_id, contact_id) references crm.contacts(tenant_id, id) on delete set null (contact_id),
  foreign key (tenant_id, lead_id) references crm.leads(tenant_id, id) on delete cascade,
  foreign key (tenant_id, opportunity_id) references crm.opportunities(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assigned_member_id) references core.tenant_members(tenant_id, id) on delete set null (assigned_member_id)
);
create index activities_tenant_customer_idx on crm.activities (tenant_id, customer_id, created_at desc);
create index activities_tenant_lead_idx on crm.activities (tenant_id, lead_id, created_at desc);
create index activities_tenant_opportunity_idx on crm.activities (tenant_id, opportunity_id, created_at desc);
create index activities_tenant_contact_idx on crm.activities (tenant_id, contact_id);
create index activities_tenant_assigned_idx on crm.activities (tenant_id, assigned_member_id);
create index activities_due_idx on crm.activities (due_at) where done_at is null and reminder_notified_at is null;
create index activities_created_by_idx on crm.activities (created_by);

-- =============================================================================
-- Trigger: Zeitstempel, Nummern, Abschluss
-- =============================================================================
create trigger customers_updated_at before update on crm.customers for each row execute function core.set_updated_at();
create trigger contacts_updated_at before update on crm.contacts for each row execute function core.set_updated_at();
create trigger leads_updated_at before update on crm.leads for each row execute function core.set_updated_at();
create trigger pipelines_updated_at before update on crm.pipelines for each row execute function core.set_updated_at();
create trigger pipeline_stages_updated_at before update on crm.pipeline_stages for each row execute function core.set_updated_at();
create trigger opportunities_updated_at before update on crm.opportunities for each row execute function core.set_updated_at();
create trigger activities_updated_at before update on crm.activities for each row execute function core.set_updated_at();

create or replace function crm.assign_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Nummern vergibt immer das System (keine eigenen oder doppelten Nummern)
  new.number := crm.next_number(new.tenant_id,
    case tg_table_name when 'customers' then 'customer' when 'leads' then 'lead' else 'opportunity' end,
    case tg_table_name when 'customers' then 'K-' when 'leads' then 'L-' else 'V-' end);
  return new;
end $$;
create trigger customers_number before insert on crm.customers for each row execute function crm.assign_number();
create trigger leads_number before insert on crm.leads for each row execute function crm.assign_number();
create trigger opportunities_number before insert on crm.opportunities for each row execute function crm.assign_number();

-- Nummer, Unternehmen, Ersteller und Erinnerungsstatus setzt nur das System.
-- Wird eine Wiedervorlage oder Fälligkeit verschoben, erinnert NOVA erneut.
create or replace function crm.keep_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.number := old.number;
  new.tenant_id := old.tenant_id;
  new.created_by := old.created_by;
  if tg_table_name = 'leads' and current_user = 'authenticated' then
    new.follow_up_notified_at := case when new.follow_up_at is distinct from old.follow_up_at then null
                                      else old.follow_up_notified_at end;
  end if;
  return new;
end $$;

create or replace function crm.protect_activity()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.created_by := old.created_by;
  if current_user = 'authenticated' then
    new.reminder_notified_at := case when new.due_at is distinct from old.due_at then null
                                     else old.reminder_notified_at end;
  end if;
  return new;
end $$;
create trigger activities_protect before update on crm.activities for each row execute function crm.protect_activity();
create trigger customers_keep_number before update on crm.customers for each row execute function crm.keep_number();
create trigger leads_keep_number before update on crm.leads for each row execute function crm.keep_number();
create trigger opportunities_keep_number before update on crm.opportunities for each row execute function crm.keep_number();

-- Gewonnen/verloren setzt das Abschlussdatum, zurück auf offen entfernt es
create or replace function crm.track_opportunity_close()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  select kind into v_kind from crm.pipeline_stages where id = new.stage_id;
  if v_kind in ('won', 'lost') then
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := null;
    new.lost_reason := null;
  end if;
  return new;
end $$;
create trigger opportunities_close before insert or update of stage_id on crm.opportunities
  for each row execute function crm.track_opportunity_close();

-- =============================================================================
-- Standard-Pipeline
-- =============================================================================
create or replace function crm.ensure_default_pipeline(p_tenant uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_pipeline uuid;
begin
  select id into v_pipeline from crm.pipelines where tenant_id = p_tenant and is_default;
  if found then
    return v_pipeline;
  end if;
  insert into crm.pipelines (tenant_id, name, is_default) values (p_tenant, 'Vertrieb', true) returning id into v_pipeline;
  insert into crm.pipeline_stages (tenant_id, pipeline_id, name, position, probability, kind) values
    (p_tenant, v_pipeline, 'Neu', 1, 10, 'open'),
    (p_tenant, v_pipeline, 'Qualifiziert', 2, 25, 'open'),
    (p_tenant, v_pipeline, 'Angebot', 3, 50, 'open'),
    (p_tenant, v_pipeline, 'Verhandlung', 4, 75, 'open'),
    (p_tenant, v_pipeline, 'Gewonnen', 5, 100, 'won'),
    (p_tenant, v_pipeline, 'Verloren', 6, 0, 'lost');
  return v_pipeline;
end $$;

create or replace function crm.on_module_enabled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.module_key = 'crm' and new.enabled then
    perform crm.ensure_default_pipeline(new.tenant_id);
  end if;
  return new;
end $$;
create trigger tenant_modules_crm_setup after insert or update of enabled on core.tenant_modules
  for each row execute function crm.on_module_enabled();

-- =============================================================================
-- Protokoll, Suche, Benachrichtigungen
-- =============================================================================
create or replace function crm.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  if not exists (select 1 from core.tenants where id = (v_row ->> 'tenant_id')::uuid) then
    return coalesce(new, old);
  end if;
  perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'crm.' || tg_table_name || '.' || lower(tg_op), tg_table_name,
    v_row ->> 'id',
    jsonb_strip_nulls(jsonb_build_object(
      'number', v_row ->> 'number',
      'name', coalesce(v_row ->> 'name', v_row ->> 'title',
                       nullif(btrim(coalesce(v_row ->> 'first_name', '') || ' ' || coalesce(v_row ->> 'last_name', '')), '')),
      'status', v_row ->> 'status')));
  return coalesce(new, old);
end $$;
create trigger customers_audit after insert or update or delete on crm.customers for each row execute function crm.write_audit_log();
create trigger contacts_audit after insert or update or delete on crm.contacts for each row execute function crm.write_audit_log();
create trigger leads_audit after insert or update or delete on crm.leads for each row execute function crm.write_audit_log();
create trigger opportunities_audit after insert or update or delete on crm.opportunities for each row execute function crm.write_audit_log();
create trigger pipelines_audit after insert or update or delete on crm.pipelines for each row execute function crm.write_audit_log();

create or replace function crm.search_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type text := case tg_table_name when 'customers' then 'customer' when 'contacts' then 'contact'
                                    when 'leads' then 'lead' else 'opportunity' end;
  v_customer text;
begin
  if tg_op = 'DELETE' then
    perform core.search_remove(v_type, old.id);
    return old;
  end if;
  if tg_table_name = 'customers' then
    if new.archived_at is not null then
      perform core.search_remove('customer', new.id);
    else
      perform core.search_upsert(new.tenant_id, 'customer', new.id, new.name,
        concat_ws(' · ', new.number, new.city, new.email), 'crm/kunden/' || new.id, 'crm.view');
    end if;
  elsif tg_table_name = 'contacts' then
    select name into v_customer from crm.customers where id = new.customer_id;
    perform core.search_upsert(new.tenant_id, 'contact', new.id,
      btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')),
      concat_ws(' · ', v_customer, new.position, new.email), 'crm/kunden/' || new.customer_id, 'crm.view');
  elsif tg_table_name = 'leads' then
    perform core.search_upsert(new.tenant_id, 'lead', new.id, new.title,
      concat_ws(' · ', new.number, new.company_name, new.contact_name, new.email), 'crm/leads/' || new.id, 'crm.view');
  else
    select name into v_customer from crm.customers where id = new.customer_id;
    perform core.search_upsert(new.tenant_id, 'opportunity', new.id, new.title,
      concat_ws(' · ', new.number, v_customer), 'crm/verkaufschancen/' || new.id, 'crm.view');
  end if;
  return new;
end $$;
create trigger customers_search after insert or update or delete on crm.customers for each row execute function crm.search_sync();
create trigger contacts_search after insert or update or delete on crm.contacts for each row execute function crm.search_sync();
create trigger leads_search after insert or update or delete on crm.leads for each row execute function crm.search_sync();
create trigger opportunities_search after insert or update or delete on crm.opportunities for each row execute function crm.search_sync();

-- Zuständigkeit zugewiesen → betroffene Person informieren (nicht bei Selbstzuweisung)
create or replace function crm.notify_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row    jsonb := to_jsonb(new);
  v_field  text := case when tg_table_name = 'activities' then 'assigned_member_id' else 'owner_member_id' end;
  v_member uuid := (v_row ->> v_field)::uuid;
  v_user   uuid;
  v_label  text;
  v_href   text;
begin
  if tg_op = 'UPDATE' and v_member is not distinct from (to_jsonb(old) ->> v_field)::uuid then
    return new;
  end if;
  if v_member is null then
    return new;
  end if;
  select user_id into v_user from core.tenant_members where id = v_member;
  if v_user is null or v_user = (select auth.uid()) then
    return new;
  end if;
  if tg_table_name = 'customers' then
    v_label := 'Du bist jetzt zuständig für den Kunden „' || (v_row ->> 'name') || '“';
    v_href := 'crm/kunden/' || (v_row ->> 'id');
  elsif tg_table_name = 'leads' then
    v_label := 'Dir wurde der Lead „' || (v_row ->> 'title') || '“ zugewiesen';
    v_href := 'crm/leads/' || (v_row ->> 'id');
  elsif tg_table_name = 'opportunities' then
    v_label := 'Dir wurde die Verkaufschance „' || (v_row ->> 'title') || '“ zugewiesen';
    v_href := 'crm/verkaufschancen/' || (v_row ->> 'id');
  else
    v_label := 'Neue Aufgabe für dich: „' || (v_row ->> 'subject') || '“';
    v_href := case when v_row ->> 'customer_id' is not null then 'crm/kunden/' || (v_row ->> 'customer_id')
                   when v_row ->> 'lead_id' is not null then 'crm/leads/' || (v_row ->> 'lead_id')
                   else 'crm/verkaufschancen/' || (v_row ->> 'opportunity_id') end;
  end if;
  perform core.notify((v_row ->> 'tenant_id')::uuid, v_user,
    case when tg_table_name = 'activities' then 'crm.task.assigned' else 'crm.assigned' end, v_label, null, v_href);
  return new;
end $$;
create trigger customers_notify after insert or update of owner_member_id on crm.customers
  for each row execute function crm.notify_assignment();
create trigger leads_notify after insert or update of owner_member_id on crm.leads
  for each row execute function crm.notify_assignment();
create trigger opportunities_notify after insert or update of owner_member_id on crm.opportunities
  for each row execute function crm.notify_assignment();
create trigger activities_notify after insert or update of assigned_member_id on crm.activities
  for each row execute function crm.notify_assignment();

-- Wiedervorlagen und fällige Aufgaben (alle 15 Minuten)
create or replace function crm.send_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    update crm.leads l set follow_up_notified_at = now()
    where l.follow_up_at <= now() and l.follow_up_notified_at is null and l.status not in ('converted', 'unqualified')
    returning l.tenant_id, l.id, l.title, l.owner_member_id, l.created_by
  loop
    perform core.notify(v_row.tenant_id,
      coalesce((select user_id from core.tenant_members where id = v_row.owner_member_id), v_row.created_by),
      'crm.follow_up.due', 'Wiedervorlage: Lead „' || v_row.title || '“', null, 'crm/leads/' || v_row.id);
    v_count := v_count + 1;
  end loop;

  for v_row in
    update crm.activities a set reminder_notified_at = now()
    where a.kind = 'task' and a.due_at <= now() and a.done_at is null and a.reminder_notified_at is null
    returning a.tenant_id, a.subject, a.assigned_member_id, a.created_by, a.customer_id, a.lead_id, a.opportunity_id
  loop
    perform core.notify(v_row.tenant_id,
      coalesce((select user_id from core.tenant_members where id = v_row.assigned_member_id), v_row.created_by),
      'crm.task.due', 'Aufgabe fällig: „' || v_row.subject || '“', null,
      case when v_row.customer_id is not null then 'crm/kunden/' || v_row.customer_id
           when v_row.lead_id is not null then 'crm/leads/' || v_row.lead_id
           else 'crm/verkaufschancen/' || v_row.opportunity_id end);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
select cron.schedule('nova-crm-reminders', '*/15 * * * *', 'select crm.send_reminders()');

-- =============================================================================
-- Fachfunktionen (SECURITY INVOKER: RLS gilt)
-- =============================================================================

-- Mögliche Dubletten (ähnlicher Name oder gleiche E-Mail-Adresse)
create or replace function crm.find_duplicates(p_tenant uuid, p_name text, p_email text default null, p_exclude uuid default null)
returns table (id uuid, number text, name text, email text, reason text)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.number, c.name, c.email,
         case when p_email is not null and lower(c.email) = lower(btrim(p_email)) then 'email' else 'name' end
  from crm.customers c
  where c.tenant_id = p_tenant
    and c.archived_at is null
    and c.id is distinct from p_exclude
    and (
      (p_email is not null and btrim(p_email) <> '' and lower(c.email) = lower(btrim(p_email)))
      or (coalesce(btrim(p_name), '') <> '' and extensions.similarity(lower(c.name), lower(btrim(p_name))) >= 0.5)
    )
  order by (p_email is not null and lower(c.email) = lower(btrim(p_email))) desc,
           extensions.similarity(lower(c.name), lower(coalesce(p_name, ''))) desc
  limit 5;
$$;

-- Lead in einen Kunden umwandeln (neuer oder bestehender Kunde), optional mit Verkaufschance
create or replace function crm.convert_lead(
  p_lead uuid,
  p_customer uuid default null,
  p_create_opportunity boolean default false
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_lead     crm.leads%rowtype;
  v_customer uuid := p_customer;
  v_pipeline uuid;
  v_stage    uuid;
  v_names    text[];
begin
  select * into v_lead from crm.leads where id = p_lead;
  if not found then
    raise exception 'Lead nicht gefunden' using errcode = 'P0002';
  end if;
  if not core.can(v_lead.tenant_id, 'crm.edit') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  -- Sperren gegen doppelte Umwandlung bei gleichzeitigen Klicks
  select * into v_lead from crm.leads where id = p_lead for update;
  if v_lead.status = 'converted' then
    raise exception 'Dieser Lead wurde bereits umgewandelt' using errcode = '22023';
  end if;

  if v_customer is null then
    insert into crm.customers (tenant_id, kind, name, email, phone, status, owner_member_id)
    values (v_lead.tenant_id,
            case when coalesce(btrim(v_lead.company_name), '') <> '' then 'company' else 'person' end,
            coalesce(nullif(btrim(v_lead.company_name), ''), nullif(btrim(v_lead.contact_name), ''), v_lead.title),
            v_lead.email, v_lead.phone, 'active', v_lead.owner_member_id)
    returning id into v_customer;
    if coalesce(btrim(v_lead.company_name), '') <> '' and coalesce(btrim(v_lead.contact_name), '') <> '' then
      v_names := regexp_split_to_array(btrim(v_lead.contact_name), '\s+');
      insert into crm.contacts (tenant_id, customer_id, first_name, last_name, email, phone, is_primary)
      values (v_lead.tenant_id, v_customer,
              case when array_length(v_names, 1) > 1 then array_to_string(v_names[1:array_length(v_names, 1) - 1], ' ') end,
              v_names[array_length(v_names, 1)], v_lead.email, v_lead.phone, true);
    end if;
  elsif not exists (select 1 from crm.customers where id = v_customer and tenant_id = v_lead.tenant_id) then
    raise exception 'Kunde nicht gefunden' using errcode = 'P0002';
  end if;

  -- Bisherige Aktivitäten des Leads erscheinen auch beim Kunden
  update crm.activities set customer_id = v_customer
  where tenant_id = v_lead.tenant_id and lead_id = v_lead.id and customer_id is null;

  if p_create_opportunity then
    select id into v_pipeline from crm.pipelines where tenant_id = v_lead.tenant_id and is_default;
    if not found then
      raise exception 'Keine Standard-Pipeline vorhanden' using errcode = 'P0002';
    end if;
    select id into v_stage from crm.pipeline_stages
    where pipeline_id = v_pipeline and kind = 'open' order by position limit 1;
    insert into crm.opportunities (tenant_id, title, customer_id, pipeline_id, stage_id, amount, owner_member_id, lead_id)
    values (v_lead.tenant_id, v_lead.title, v_customer, v_pipeline, v_stage, coalesce(v_lead.estimated_value, 0),
            v_lead.owner_member_id, v_lead.id);
  end if;

  update crm.leads set status = 'converted', converted_customer_id = v_customer, converted_at = now()
  where id = v_lead.id;
  return v_customer;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table crm.number_sequences enable row level security;
alter table crm.customers enable row level security;
alter table crm.contacts enable row level security;
alter table crm.leads enable row level security;
alter table crm.pipelines enable row level security;
alter table crm.pipeline_stages enable row level security;
alter table crm.opportunities enable row level security;
alter table crm.activities enable row level security;

-- number_sequences: kein Zugriff für Clients (nur über crm.next_number)

do $$
declare
  t text;
begin
  -- Gleiches Muster für Kunden, Ansprechpartner, Leads und Verkaufschancen
  foreach t in array array['customers', 'contacts', 'leads', 'opportunities'] loop
    execute format('create policy %1$s_select on crm.%1$s for select to authenticated using (core.can(tenant_id, ''crm.view''))', t);
    execute format('create policy %1$s_insert on crm.%1$s for insert to authenticated with check (core.can(tenant_id, ''crm.edit''))', t);
    execute format('create policy %1$s_update on crm.%1$s for update to authenticated using (core.can(tenant_id, ''crm.edit'')) with check (core.can(tenant_id, ''crm.edit''))', t);
  end loop;
end $$;
-- Löschen: Kunden, Leads, Verkaufschancen nur mit crm.manage; Ansprechpartner mit crm.edit
create policy customers_delete on crm.customers for delete to authenticated using (core.can(tenant_id, 'crm.manage'));
create policy leads_delete on crm.leads for delete to authenticated using (core.can(tenant_id, 'crm.manage'));
create policy opportunities_delete on crm.opportunities for delete to authenticated using (core.can(tenant_id, 'crm.manage'));
create policy contacts_delete on crm.contacts for delete to authenticated using (core.can(tenant_id, 'crm.edit'));

create policy pipelines_select on crm.pipelines for select to authenticated using (core.can(tenant_id, 'crm.view'));
create policy pipelines_insert on crm.pipelines for insert to authenticated with check (core.can(tenant_id, 'crm.manage'));
create policy pipelines_update on crm.pipelines for update to authenticated
  using (core.can(tenant_id, 'crm.manage')) with check (core.can(tenant_id, 'crm.manage'));
create policy pipelines_delete on crm.pipelines for delete to authenticated using (core.can(tenant_id, 'crm.manage'));
create policy pipeline_stages_select on crm.pipeline_stages for select to authenticated using (core.can(tenant_id, 'crm.view'));
create policy pipeline_stages_insert on crm.pipeline_stages for insert to authenticated with check (core.can(tenant_id, 'crm.manage'));
create policy pipeline_stages_update on crm.pipeline_stages for update to authenticated
  using (core.can(tenant_id, 'crm.manage')) with check (core.can(tenant_id, 'crm.manage'));
create policy pipeline_stages_delete on crm.pipeline_stages for delete to authenticated using (core.can(tenant_id, 'crm.manage'));

-- Aktivitäten: Lesen mit crm.view, Anlegen/Ändern mit crm.edit; Löschen eigener Einträge oder mit crm.manage
create policy activities_select on crm.activities for select to authenticated using (core.can(tenant_id, 'crm.view'));
create policy activities_insert on crm.activities for insert to authenticated
  with check (core.can(tenant_id, 'crm.edit') and created_by = (select auth.uid()));
create policy activities_update on crm.activities for update to authenticated
  using (core.can(tenant_id, 'crm.edit')) with check (core.can(tenant_id, 'crm.edit'));
create policy activities_delete on crm.activities for delete to authenticated
  using ((created_by = (select auth.uid()) and core.can(tenant_id, 'crm.edit')) or core.can(tenant_id, 'crm.manage'));

-- =============================================================================
-- Rechte
-- =============================================================================
grant select, insert, update, delete on crm.customers, crm.contacts, crm.leads, crm.pipelines,
  crm.pipeline_stages, crm.opportunities, crm.activities to authenticated;
grant all on all tables in schema crm to service_role;

revoke all on function crm.next_number(uuid, text, text) from public, anon, authenticated;
revoke all on function crm.assign_number() from public, anon, authenticated;
revoke all on function crm.keep_number() from public, anon, authenticated;
revoke all on function crm.protect_activity() from public, anon, authenticated;
revoke all on function crm.track_opportunity_close() from public, anon, authenticated;
revoke all on function crm.ensure_default_pipeline(uuid) from public, anon, authenticated;
revoke all on function crm.on_module_enabled() from public, anon, authenticated;
revoke all on function crm.write_audit_log() from public, anon, authenticated;
revoke all on function crm.search_sync() from public, anon, authenticated;
revoke all on function crm.notify_assignment() from public, anon, authenticated;
revoke all on function crm.send_reminders() from public, anon, authenticated;
revoke all on function crm.find_duplicates(uuid, text, text, uuid) from public, anon;
revoke all on function crm.convert_lead(uuid, uuid, boolean) from public, anon;
grant execute on function crm.find_duplicates(uuid, text, text, uuid) to authenticated;
grant execute on function crm.convert_lead(uuid, uuid, boolean) to authenticated;
grant execute on function crm.send_reminders() to service_role;

-- =============================================================================
-- Bestehende Unternehmen erhalten das CRM (vor der Abrechnung: Standard)
-- =============================================================================
insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select id, 'crm', true, 'included' from core.tenants
on conflict (tenant_id, module_key) do nothing;
