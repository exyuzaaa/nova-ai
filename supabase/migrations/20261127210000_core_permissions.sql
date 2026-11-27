-- =============================================================================
-- NOVA CORE – Unternehmensprofil, Module, Rechte, Rollen, Abteilungen, Teams
-- (Plattform-Phase 1b)
-- -----------------------------------------------------------------------------
-- Rechtemodell
--   * Basisrolle je Mitglied (viewer < member < admin < owner) wie bisher.
--   * Rechtekatalog core.permissions ("modul.ressource.aktion"). Jedes Recht hat
--     eine Standard-Mindestrolle; wer diese Basisrolle hat, besitzt das Recht.
--   * Eigene Rollen (core.roles) geben Mitgliedern ZUSÄTZLICHE Rechte. Nur Rechte
--     mit grantable = true dürfen in eigene Rollen; Verwaltungsrechte des Kerns
--     (Mitglieder, Rollen, Module, Einstellungen, Abrechnung) bleiben an die
--     Basisrolle gebunden. Wer eine Rolle vergibt, muss jedes ihrer Rechte selbst
--     besitzen (keine Rechteausweitung).
--   * core.can(tenant, recht) prüft: Mitgliedschaft, Unternehmen aktiv (nicht
--     gesperrt), Modul freigeschaltet, Recht über Basis- oder eigene Rolle.
--
-- Module
--   * core.modules ist der Katalog (vom Betreiber gepflegt), core.tenant_modules
--     die Freischaltung je Unternehmen. Neue Unternehmen erhalten automatisch alle
--     Module mit enabled_by_default. Bis zur Abrechnung (Plattform-Phase 6) ist
--     core.module_entitled() immer wahr; danach entscheidet das Abonnement.
--   * Analytics ist ab jetzt ein freischaltbares Modul: Ist es deaktiviert oder
--     das Unternehmen gesperrt, sind Analytics-Daten gesperrt und es werden keine
--     neuen Events erfasst.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Unternehmensprofil
-- -----------------------------------------------------------------------------
alter table core.tenants
  add column legal_name              text check (char_length(legal_name) <= 200),
  add column street                  text check (char_length(street) <= 200),
  add column postal_code             text check (char_length(postal_code) <= 20),
  add column city                    text check (char_length(city) <= 120),
  add column country_code            char(2) not null default 'DE' check (country_code ~ '^[A-Z]{2}$'),
  add column phone                   text check (char_length(phone) <= 50),
  add column email                   text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column website                 text check (char_length(website) <= 200),
  add column vat_id                  text check (char_length(vat_id) <= 30),
  add column industry                text check (char_length(industry) <= 80),
  add column company_size            text check (company_size in ('1', '2-10', '11-50', '51-200', '201-1000', '1000+')),
  add column locale                  text not null default 'de' check (locale in ('de', 'en')),
  add column timezone                text not null default 'Europe/Berlin' check (char_length(timezone) <= 64),
  add column currency                char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column logo_path               text check (char_length(logo_path) <= 300),
  -- Sperre nur durch den Betreiber (NOVA MASTER), nie durch Kunden
  add column status                  text not null default 'active' check (status in ('active', 'suspended')),
  add column suspended_at            timestamptz,
  add column suspended_reason        text check (char_length(suspended_reason) <= 500),
  add column onboarding_completed_at timestamptz;

-- Zusammengesetzte Schlüssel: Datensätze dürfen nur auf Datensätze DESSELBEN Unternehmens zeigen.
alter table core.tenant_members add constraint tenant_members_tenant_id_id_key unique (tenant_id, id);

-- -----------------------------------------------------------------------------
-- Modulkatalog und Freischaltung
-- -----------------------------------------------------------------------------
create table core.modules (
  key                text primary key check (key ~ '^[a-z][a-z_]{1,30}$'),
  name               text not null check (char_length(name) between 1 and 80),
  description        text not null check (char_length(description) <= 500),
  category           text not null check (category in ('platform', 'business', 'administration', 'operations', 'growth', 'insights')),
  -- available: nutzbar; beta: nutzbar mit Hinweis; planned: angekündigt, nicht aktivierbar; retired: abgekündigt
  status             text not null default 'planned' check (status in ('available', 'beta', 'planned', 'retired')),
  is_core            boolean not null default false,
  enabled_by_default boolean not null default false,
  sort_order         integer not null default 100,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger modules_updated_at before update on core.modules
  for each row execute function core.set_updated_at();

insert into core.modules (key, name, description, category, status, is_core, enabled_by_default, sort_order) values
  ('core',       'NOVA Core',          'Unternehmen, Mitglieder, Rollen, Abteilungen, Teams, Einstellungen und Protokoll.', 'platform',       'available', true,  true,  0),
  ('crm',        'CRM',                'Kunden, Ansprechpartner, Leads, Pipelines und Verkaufschancen.',                    'business',       'planned',   false, false, 10),
  ('projects',   'Projekte',           'Projekte, Aufgaben, Meilensteine, Zeiterfassung, Kanban und Gantt.',                'business',       'planned',   false, false, 20),
  ('calendar',   'Kalender',           'Persönliche, Team- und Unternehmenskalender mit Terminen und Erinnerungen.',        'business',       'planned',   false, false, 30),
  ('hr',         'Personal',           'Mitarbeiter, Abwesenheiten, Urlaub, Arbeitszeiten und Onboarding.',                 'administration', 'planned',   false, false, 40),
  ('finance',    'Finanzen',           'Angebote, Rechnungen, E-Rechnungen, Ausgaben und Finanzübersicht.',                 'administration', 'planned',   false, false, 50),
  ('documents',  'Dokumente',          'Ordner, Dateien, Versionen und Freigaben.',                                        'administration', 'planned',   false, false, 60),
  ('messaging',  'Kommunikation',      'Direktnachrichten, Gruppen und Kanäle.',                                           'administration', 'planned',   false, false, 70),
  ('support',    'Support',            'Tickets, SLA, Kundenportal und Wissensdatenbank.',                                 'operations',     'planned',   false, false, 80),
  ('inventory',  'Lager',              'Artikel, Lagerorte, Bestände, Bewegungen und Bestellungen.',                       'operations',     'planned',   false, false, 90),
  ('marketing',  'Marketing',          'Kampagnen, Zielgruppen, Vertriebsaktivitäten und Einwilligungen.',                 'growth',         'planned',   false, false, 100),
  ('automation', 'Automatisierungen',  'Workflows mit Auslösern, Bedingungen und Aktionen.',                               'growth',         'planned',   false, false, 110),
  ('analytics',  'Analytics',          'Datenschutzfreundliche Web-Analyse mit Echtzeit und Besucheranalyse.',             'insights',       'available', false, true,  120);

create table core.tenant_modules (
  tenant_id   uuid not null references core.tenants(id) on delete cascade,
  module_key  text not null references core.modules(key),
  enabled     boolean not null default true,
  -- included: Standard; plan/addon/trial: aus der Abrechnung (Phase 6); manual: durch Betreiber
  source      text not null default 'included' check (source in ('included', 'plan', 'addon', 'trial', 'manual')),
  valid_until timestamptz,
  changed_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, module_key)
);
create trigger tenant_modules_updated_at before update on core.tenant_modules
  for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Rechtekatalog, eigene Rollen
-- -----------------------------------------------------------------------------
create table core.permissions (
  key          text primary key check (key ~ '^[a-z_]+(\.[a-z_]+){1,3}$'),
  module_key   text not null references core.modules(key),
  name         text not null check (char_length(name) between 1 and 120),
  description  text check (char_length(description) <= 300),
  default_role core.member_role not null,
  grantable    boolean not null default true,
  is_sensitive boolean not null default false,
  sort_order   integer not null default 100
);
create index permissions_module_idx on core.permissions (module_key);

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('core.members.read',      'core', 'Mitglieder ansehen',              'Liste der Mitglieder und ihrer Rollen.',                         'viewer', true,  false, 10),
  ('core.members.manage',    'core', 'Mitglieder verwalten',            'Einladen, Rollen ändern, entfernen.',                            'admin',  false, false, 11),
  ('core.roles.manage',      'core', 'Rollen verwalten',                'Eigene Rollen anlegen und vergeben.',                            'admin',  false, false, 12),
  ('core.departments.read',  'core', 'Abteilungen und Teams ansehen',   null,                                                             'viewer', true,  false, 20),
  ('core.departments.manage','core', 'Abteilungen und Teams verwalten', 'Anlegen, ändern, Mitglieder zuordnen.',                          'admin',  true,  false, 21),
  ('core.modules.manage',    'core', 'Module verwalten',                'Module für das Unternehmen ein- und ausschalten.',               'admin',  false, false, 30),
  ('core.settings.manage',   'core', 'Unternehmensprofil bearbeiten',   'Name, Anschrift, Kontakt, Sprache, Zeitzone.',                    'admin',  false, false, 40),
  ('core.audit.read',        'core', 'Protokoll ansehen',               'Änderungsprotokoll des Unternehmens.',                           'admin',  true,  true,  50),
  ('core.billing.manage',    'core', 'Abonnement verwalten',            'Paket, Zahlungsart, Rechnungen, Kündigung.',                      'owner',  false, true,  60),
  ('analytics.view',         'analytics', 'Analytics ansehen',          'Dashboards, Echtzeit und Besucheranalyse.',                      'viewer', true,  false, 10),
  ('analytics.edit',         'analytics', 'Analytics bearbeiten',       'Ziele, Funnels, Kampagnen und Berichte pflegen.',                'member', true,  false, 20),
  ('analytics.manage',       'analytics', 'Websites und Tracking verwalten', 'Websites anlegen, Tracking-Einstellungen ändern.',          'admin',  true,  false, 30);

create table core.roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references core.tenants(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 300),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index roles_tenant_name_key on core.roles (tenant_id, lower(name));
create trigger roles_updated_at before update on core.roles
  for each row execute function core.set_updated_at();

create table core.role_permissions (
  tenant_id      uuid not null,
  role_id        uuid not null,
  permission_key text not null references core.permissions(key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (tenant_id, role_id) references core.roles(tenant_id, id) on delete cascade
);
create index role_permissions_tenant_idx on core.role_permissions (tenant_id);

create table core.member_roles (
  tenant_id  uuid not null,
  member_id  uuid not null,
  role_id    uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (member_id, role_id),
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id) references core.roles(tenant_id, id) on delete cascade
);
create index member_roles_role_idx on core.member_roles (role_id);
create index member_roles_tenant_idx on core.member_roles (tenant_id);

-- -----------------------------------------------------------------------------
-- Abteilungen und Teams
-- -----------------------------------------------------------------------------
create table core.departments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references core.tenants(id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 120),
  description    text check (char_length(description) <= 500),
  parent_id      uuid,
  lead_member_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  check (parent_id is null or parent_id <> id),
  foreign key (tenant_id, parent_id) references core.departments(tenant_id, id) on delete set null (parent_id),
  foreign key (tenant_id, lead_member_id) references core.tenant_members(tenant_id, id) on delete set null (lead_member_id)
);
create unique index departments_tenant_name_key on core.departments (tenant_id, lower(name));
create index departments_parent_idx on core.departments (parent_id);
create trigger departments_updated_at before update on core.departments
  for each row execute function core.set_updated_at();

create table core.teams (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references core.tenants(id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 120),
  description    text check (char_length(description) <= 500),
  department_id  uuid,
  lead_member_id uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, department_id) references core.departments(tenant_id, id) on delete set null (department_id),
  foreign key (tenant_id, lead_member_id) references core.tenant_members(tenant_id, id) on delete set null (lead_member_id)
);
create unique index teams_tenant_name_key on core.teams (tenant_id, lower(name));
create index teams_department_idx on core.teams (department_id);
create trigger teams_updated_at before update on core.teams
  for each row execute function core.set_updated_at();

create table core.team_members (
  tenant_id  uuid not null,
  team_id    uuid not null,
  member_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, member_id),
  foreign key (tenant_id, team_id) references core.teams(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete cascade
);
create index team_members_member_idx on core.team_members (member_id);
create index team_members_tenant_idx on core.team_members (tenant_id);

-- Keine Zyklen in der Abteilungshierarchie (A unter B unter A)
create or replace function core.prevent_department_cycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and exists (
    with recursive ancestors(id) as (
      select new.parent_id
      union
      select d.parent_id from core.departments d join ancestors a on d.id = a.id where d.parent_id is not null
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'Eine Abteilung kann nicht unter sich selbst liegen' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger departments_no_cycle before insert or update of parent_id on core.departments
  for each row execute function core.prevent_department_cycle();

-- =============================================================================
-- Autorisierung
-- =============================================================================

-- Ob ein Unternehmen ein Modul nutzen DARF (Lizenz). Bis zur Abrechnung (Phase 6)
-- immer wahr; danach liest diese Funktion den Abonnementstatus.
create or replace function core.module_entitled(p_tenant uuid, p_module text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_tenant is not null and p_module is not null;
$$;

-- Ob ein Modul für ein Unternehmen freigeschaltet und nutzbar ist.
create or replace function core.module_enabled(p_tenant uuid, p_module text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.modules m
    where m.key = p_module
      and m.status in ('available', 'beta')
      and (
        m.is_core
        or exists (
          select 1 from core.tenant_modules tm
          where tm.tenant_id = p_tenant and tm.module_key = m.key and tm.enabled
            and (tm.valid_until is null or tm.valid_until > now())
        )
      )
      and core.module_entitled(p_tenant, p_module)
  );
$$;

-- Zentrale Rechteprüfung für Policies und Server.
create or replace function core.can(p_tenant uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from core.tenant_members m
    join core.tenants t on t.id = m.tenant_id and t.deleted_at is null and t.status = 'active'
    join core.permissions p on p.key = p_permission
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and core.module_enabled(p_tenant, p.module_key)
      and (
        m.role >= p.default_role
        or exists (
          select 1 from core.member_roles mr
          join core.role_permissions rp on rp.role_id = mr.role_id
          where mr.member_id = m.id and rp.permission_key = p.key
        )
      )
  );
$$;

-- Zugriff mit Mindestrolle auf ein Modul eines aktiven Unternehmens (für Module, deren
-- Policies auf Basisrollen beruhen, z. B. Analytics).
create or replace function core.tenant_access(p_tenant uuid, p_min core.member_role, p_module text)
returns boolean language sql stable security definer set search_path = '' as $$
  select core.has_tenant_role(p_tenant, p_min)
     and exists (select 1 from core.tenants t where t.id = p_tenant and t.status = 'active')
     and core.module_enabled(p_tenant, p_module);
$$;

-- Alle Rechte des angemeldeten Nutzers in einem Unternehmen (für die Oberfläche).
create or replace function core.my_permissions(p_tenant uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  select p.key from core.permissions p where core.can(p_tenant, p.key) order by p.key;
$$;

-- Standardmodule für neue Unternehmen
create or replace function core.enable_default_modules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into core.tenant_modules (tenant_id, module_key, enabled, source)
  select new.id, m.key, true, 'included'
  from core.modules m
  where m.enabled_by_default and not m.is_core and m.status in ('available', 'beta')
  on conflict do nothing;
  return new;
end $$;
create trigger tenants_default_modules after insert on core.tenants
  for each row execute function core.enable_default_modules();

-- Bestehende Unternehmen behalten Analytics
insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select t.id, 'analytics', true, 'included' from core.tenants t
on conflict do nothing;

-- Modul ein- oder ausschalten (ab Admin; nur verfügbare und lizenzierte Module).
create or replace function core.set_module_enabled(p_tenant uuid, p_module text, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_module core.modules%rowtype;
begin
  if not core.can(p_tenant, 'core.modules.manage') then
    raise exception 'Keine Berechtigung, Module zu verwalten' using errcode = '42501';
  end if;
  select * into v_module from core.modules where key = p_module;
  if not found then
    raise exception 'Unbekanntes Modul' using errcode = '22023';
  end if;
  if v_module.is_core then
    raise exception 'Der Kern kann nicht ausgeschaltet werden' using errcode = '22023';
  end if;
  if p_enabled and v_module.status not in ('available', 'beta') then
    raise exception 'Dieses Modul ist noch nicht verfügbar' using errcode = '22023';
  end if;
  if p_enabled and not core.module_entitled(p_tenant, p_module) then
    raise exception 'Dieses Modul ist in deinem Paket nicht enthalten' using errcode = '42501';
  end if;

  insert into core.tenant_modules (tenant_id, module_key, enabled, source, changed_by)
  values (p_tenant, p_module, p_enabled, 'included', (select auth.uid()))
  on conflict (tenant_id, module_key)
  do update set enabled = excluded.enabled, changed_by = excluded.changed_by;
end $$;

-- =============================================================================
-- Audit
-- =============================================================================
create or replace function core.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row    jsonb := to_jsonb(coalesce(new, old));
  v_old    jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_tenant uuid;
  v_meta   jsonb := '{}';
  v_target text;
begin
  v_tenant := coalesce(
    (v_row ->> 'tenant_id')::uuid,
    case when tg_table_name = 'tenants' then (v_row ->> 'id')::uuid end
  );
  v_target := coalesce(v_row ->> 'id', v_row ->> 'module_key', v_row ->> 'role_id');
  if tg_table_name = 'tenant_members' then
    v_meta := jsonb_build_object('user_id', v_row ->> 'user_id', 'role', v_row ->> 'role',
                                 'previous_role', v_old ->> 'role');
  elsif tg_table_name = 'invitations' then
    v_meta := jsonb_build_object('email', v_row ->> 'email', 'role', v_row ->> 'role',
                                 'accepted', (v_row ->> 'accepted_at') is not null);
  elsif tg_table_name = 'tenants' then
    v_meta := jsonb_build_object('name', v_row ->> 'name', 'status', v_row ->> 'status');
  elsif tg_table_name = 'tenant_modules' then
    v_meta := jsonb_build_object('module', v_row ->> 'module_key', 'enabled', (v_row ->> 'enabled')::boolean);
  elsif tg_table_name in ('roles', 'departments', 'teams') then
    v_meta := jsonb_build_object('name', v_row ->> 'name');
  elsif tg_table_name = 'role_permissions' then
    v_meta := jsonb_build_object('role_id', v_row ->> 'role_id', 'permission', v_row ->> 'permission_key');
  elsif tg_table_name = 'member_roles' then
    v_meta := jsonb_build_object('member_id', v_row ->> 'member_id', 'role_id', v_row ->> 'role_id');
  end if;
  -- Kaskaden beim Löschen eines Unternehmens nicht protokollieren (Fremdschlüssel wäre ungültig)
  if v_tenant is not null and not exists (select 1 from core.tenants where id = v_tenant) then
    return coalesce(new, old);
  end if;
  perform core.log_audit(v_tenant, tg_table_name || '.' || lower(tg_op), tg_table_name, v_target, v_meta);
  return coalesce(new, old);
end $$;

create trigger tenant_modules_audit after insert or update on core.tenant_modules
  for each row execute function core.write_audit_log();
create trigger roles_audit after insert or update or delete on core.roles
  for each row execute function core.write_audit_log();
create trigger role_permissions_audit after insert or delete on core.role_permissions
  for each row execute function core.write_audit_log();
create trigger member_roles_audit after insert or delete on core.member_roles
  for each row execute function core.write_audit_log();
create trigger departments_audit after insert or update or delete on core.departments
  for each row execute function core.write_audit_log();
create trigger teams_audit after insert or update or delete on core.teams
  for each row execute function core.write_audit_log();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table core.modules enable row level security;
alter table core.tenant_modules enable row level security;
alter table core.permissions enable row level security;
alter table core.roles enable row level security;
alter table core.role_permissions enable row level security;
alter table core.member_roles enable row level security;
alter table core.departments enable row level security;
alter table core.teams enable row level security;
alter table core.team_members enable row level security;

-- Kataloge sind für angemeldete Nutzer lesbar (keine Kundendaten)
create policy modules_select on core.modules for select to authenticated using (true);
create policy permissions_select on core.permissions for select to authenticated using (true);

-- Freischaltungen: Mitglieder sehen sie; Änderungen nur über set_module_enabled
create policy tenant_modules_select on core.tenant_modules for select to authenticated
  using (core.has_tenant_role(tenant_id, 'viewer'));

-- Eigene Rollen: Mitglieder sehen sie, Verwaltung ab core.roles.manage
create policy roles_select on core.roles for select to authenticated
  using (core.can(tenant_id, 'core.members.read'));
create policy roles_insert on core.roles for insert to authenticated
  with check (core.can(tenant_id, 'core.roles.manage'));
create policy roles_update on core.roles for update to authenticated
  using (core.can(tenant_id, 'core.roles.manage')) with check (core.can(tenant_id, 'core.roles.manage'));
create policy roles_delete on core.roles for delete to authenticated
  using (core.can(tenant_id, 'core.roles.manage'));

create policy role_permissions_select on core.role_permissions for select to authenticated
  using (core.can(tenant_id, 'core.members.read'));
-- Nur vergebbare Rechte, die der Handelnde selbst besitzt
create policy role_permissions_insert on core.role_permissions for insert to authenticated
  with check (
    core.can(tenant_id, 'core.roles.manage')
    and core.can(tenant_id, permission_key)
    and exists (select 1 from core.permissions p where p.key = permission_key and p.grantable)
  );
create policy role_permissions_delete on core.role_permissions for delete to authenticated
  using (core.can(tenant_id, 'core.roles.manage'));

create policy member_roles_select on core.member_roles for select to authenticated
  using (core.can(tenant_id, 'core.members.read'));
-- Wer eine Rolle vergibt, muss jedes ihrer Rechte selbst besitzen
create policy member_roles_insert on core.member_roles for insert to authenticated
  with check (
    core.can(tenant_id, 'core.roles.manage')
    and not exists (
      select 1 from core.role_permissions rp
      where rp.role_id = member_roles.role_id and not core.can(rp.tenant_id, rp.permission_key)
    )
  );
create policy member_roles_delete on core.member_roles for delete to authenticated
  using (core.can(tenant_id, 'core.roles.manage'));

create policy departments_select on core.departments for select to authenticated
  using (core.can(tenant_id, 'core.departments.read'));
create policy departments_write on core.departments for all to authenticated
  using (core.can(tenant_id, 'core.departments.manage'))
  with check (core.can(tenant_id, 'core.departments.manage'));

create policy teams_select on core.teams for select to authenticated
  using (core.can(tenant_id, 'core.departments.read'));
create policy teams_write on core.teams for all to authenticated
  using (core.can(tenant_id, 'core.departments.manage'))
  with check (core.can(tenant_id, 'core.departments.manage'));

create policy team_members_select on core.team_members for select to authenticated
  using (core.can(tenant_id, 'core.departments.read'));
create policy team_members_write on core.team_members for all to authenticated
  using (core.can(tenant_id, 'core.departments.manage'))
  with check (core.can(tenant_id, 'core.departments.manage'));

-- Unternehmensprofil: Bearbeiten ab core.settings.manage (= Admin)
drop policy tenants_update on core.tenants;
create policy tenants_update on core.tenants for update to authenticated
  using (core.can(id, 'core.settings.manage')) with check (core.can(id, 'core.settings.manage'));

-- Protokoll: Lesen mit core.audit.read
drop policy audit_logs_select on core.audit_logs;
create policy audit_logs_select on core.audit_logs for select to authenticated
  using (core.can(tenant_id, 'core.audit.read'));

-- =============================================================================
-- Analytics: Modulfreischaltung und Sperre durchsetzen
-- =============================================================================
create or replace function analytics.has_org_role(p_org uuid, p_min core.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select core.tenant_access(p_org, p_min, 'analytics');
$$;

create or replace function analytics.accessible_website_ids(p_min core.member_role)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select w.id
  from analytics.websites w
  join core.tenants t on t.id = w.organization_id and t.deleted_at is null and t.status = 'active'
  join core.tenant_members m
    on m.tenant_id = w.organization_id
   and m.user_id = (select auth.uid())
   and m.role >= p_min
  where w.deleted_at is null
    and core.module_enabled(w.organization_id, 'analytics')
    and (
      m.role >= 'admin'
      or not exists (select 1 from analytics.organization_member_websites r where r.member_id = m.id)
      or exists (select 1 from analytics.organization_member_websites r
                 where r.member_id = m.id and r.website_id = w.id)
    );
$$;

-- Erfassung: nur für aktive Unternehmen mit freigeschaltetem Analytics.
-- Gezielte Textänderung der bestehenden Funktion (Rest bleibt unverändert).
do $$
declare
  d text;
  v_join constant text := 'join core.tenants o on o.id = w.organization_id and o.deleted_at is null';
  v_found constant text := E'  if not found then\n    return ''unknown_site'';\n  end if;';
begin
  d := pg_get_functiondef('public.nova_ingest_event(jsonb)'::regprocedure);
  if position(v_join in d) = 0 or position(v_found in d) = 0 then
    raise exception 'nova_ingest_event hat nicht den erwarteten Aufbau';
  end if;
  d := replace(d, v_join, v_join || ' and o.status = ''active''');
  d := replace(d, v_found, v_found || E'\n  -- Modul Analytics muss für das Unternehmen freigeschaltet sein\n'
                                   || E'  if not core.module_enabled(v_site.organization_id, ''analytics'') then\n'
                                   || E'    return ''ignored'';\n  end if;');
  execute d;
end $$;

-- =============================================================================
-- Rechte
-- =============================================================================
revoke all on core.modules, core.tenant_modules, core.permissions, core.roles, core.role_permissions,
  core.member_roles, core.departments, core.teams, core.team_members from public, anon, authenticated;

grant select on core.modules, core.permissions, core.tenant_modules to authenticated;
grant select, insert, update, delete on core.roles, core.departments, core.teams to authenticated;
grant select, insert, delete on core.role_permissions, core.member_roles, core.team_members to authenticated;
grant update (name, legal_name, street, postal_code, city, country_code, phone, email, website, vat_id,
              industry, company_size, locale, timezone, currency, logo_path, onboarding_completed_at)
  on core.tenants to authenticated;

grant all on core.modules, core.tenant_modules, core.permissions, core.roles, core.role_permissions,
  core.member_roles, core.departments, core.teams, core.team_members to service_role;

revoke all on function core.module_entitled(uuid, text) from public, anon, authenticated;
revoke all on function core.module_enabled(uuid, text) from public, anon;
revoke all on function core.can(uuid, text) from public, anon;
revoke all on function core.tenant_access(uuid, core.member_role, text) from public, anon;
revoke all on function core.my_permissions(uuid) from public, anon;
revoke all on function core.set_module_enabled(uuid, text, boolean) from public, anon;
revoke all on function core.enable_default_modules() from public, anon, authenticated;
revoke all on function core.prevent_department_cycle() from public, anon, authenticated;

grant execute on function core.module_enabled(uuid, text) to authenticated, service_role;
grant execute on function core.can(uuid, text) to authenticated, service_role;
grant execute on function core.tenant_access(uuid, core.member_role, text) to authenticated, service_role;
grant execute on function core.my_permissions(uuid) to authenticated;
grant execute on function core.set_module_enabled(uuid, text, boolean) to authenticated;
grant execute on function core.module_entitled(uuid, text) to service_role;
