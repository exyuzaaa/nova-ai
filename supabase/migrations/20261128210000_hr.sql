-- =============================================================================
-- NOVA Personal (HR) – Mitarbeiter, Vorgesetzte, sensible Daten, Abwesenheiten
-- mit Genehmigung, Urlaubsanspruch und Resturlaub, Onboarding (Phase 2d)
-- -----------------------------------------------------------------------------
-- Grundsätze
--   * Verzeichnis (Name, Position, Abteilung, Vorgesetzte, dienstliche Kontakte)
--     für alle mit hr.view. Private und Vergütungsdaten liegen in einer eigenen
--     Tabelle (hr.employee_private) und sind nur mit hr.sensitive sichtbar.
--   * Abwesenheiten: Antrag durch die Person selbst (hr.absences.request),
--     Entscheidung durch die direkte Führungskraft oder hr.manage. Krankheit ist
--     Gesundheitsdatum: die Art sehen nur die Person, ihre Führungskraft und
--     hr.manage – alle anderen sehen nur „abwesend“.
--   * Urlaubstage zählen Arbeitstage der Person (Wochentage laut Arbeitszeitmodell,
--     ohne Feiertage des Unternehmens).
-- =============================================================================

update core.modules set status = 'available', enabled_by_default = true where key = 'hr';

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('hr.view',             'hr', 'Personal ansehen',         'Mitarbeiterverzeichnis und Abwesenheitsübersicht (ohne Gründe).',             'viewer', true, false, 10),
  ('hr.absences.request', 'hr', 'Abwesenheit beantragen',    'Eigenen Urlaub und eigene Abwesenheiten beantragen und zurückziehen.',        'member', true, false, 20),
  ('hr.manage',           'hr', 'Personal verwalten',        'Mitarbeiter anlegen und ändern, alle Abwesenheiten sehen und entscheiden.',   'admin',  true, false, 30),
  ('hr.sensitive',        'hr', 'Vertrauliche Personaldaten', 'Private Kontaktdaten, Bankverbindung, Steuer- und Sozialversicherungsdaten, Vergütung.', 'owner', true, true, 40);

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table hr.counters (
  tenant_id  uuid primary key references core.tenants(id) on delete cascade,
  next_value bigint not null default 1
);

create table hr.employees (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references core.tenants(id) on delete cascade,
  personnel_number    text not null default '',
  member_id           uuid,
  first_name          text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name           text not null check (char_length(btrim(last_name)) between 1 and 100),
  work_email          text check (work_email is null or work_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  work_phone          text check (char_length(work_phone) <= 50),
  position            text check (char_length(position) <= 120),
  department_id       uuid,
  manager_employee_id uuid,
  employment_type     text not null default 'full_time'
                      check (employment_type in ('full_time', 'part_time', 'mini_job', 'apprentice', 'intern', 'working_student', 'freelancer')),
  entry_date          date,
  exit_date           date,
  weekly_hours        numeric(4, 1) check (weekly_hours between 0 and 80),
  work_days           smallint[] not null default '{1,2,3,4,5}' check (work_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  vacation_days       numeric(4, 1) not null default 30 check (vacation_days between 0 and 100),
  created_by          uuid references auth.users(id) on delete set null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, personnel_number),
  check (exit_date is null or entry_date is null or exit_date >= entry_date),
  check (manager_employee_id is distinct from id),
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete set null (member_id),
  foreign key (tenant_id, department_id) references core.departments(tenant_id, id) on delete set null (department_id),
  foreign key (tenant_id, manager_employee_id) references hr.employees(tenant_id, id) on delete set null (manager_employee_id)
);
create unique index employees_member_idx on hr.employees (member_id) where member_id is not null;
create index employees_manager_idx on hr.employees (tenant_id, manager_employee_id) where manager_employee_id is not null;
create index employees_department_idx on hr.employees (tenant_id, department_id) where department_id is not null;
create index employees_name_idx on hr.employees (tenant_id, last_name, first_name);
create index employees_created_by_idx on hr.employees (created_by);

-- Vertrauliche Daten (eigene Tabelle, eigenes Recht)
create table hr.employee_private (
  employee_id        uuid primary key,
  tenant_id          uuid not null,
  birth_date         date,
  private_email      text check (private_email is null or private_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  private_phone      text check (char_length(private_phone) <= 50),
  street             text check (char_length(street) <= 200),
  postal_code        text check (char_length(postal_code) <= 20),
  city               text check (char_length(city) <= 120),
  country_code       char(2) check (country_code ~ '^[A-Z]{2}$'),
  iban               text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$'),
  bic                text check (bic is null or bic ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  tax_id             text check (char_length(tax_id) <= 20),
  social_security_no text check (char_length(social_security_no) <= 20),
  health_insurance   text check (char_length(health_insurance) <= 120),
  salary_amount      numeric(12, 2) check (salary_amount >= 0),
  salary_period      text check (salary_period in ('month', 'year', 'hour')),
  emergency_contact  text check (char_length(emergency_contact) <= 300),
  notes              text check (char_length(notes) <= 5000),
  updated_at         timestamptz not null default now(),
  foreign key (tenant_id, employee_id) references hr.employees(tenant_id, id) on delete cascade
);
create index employee_private_tenant_idx on hr.employee_private (tenant_id);

create table hr.absence_types (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references core.tenants(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 60),
  color             text not null default '#0ea5e9' check (color ~ '^#[0-9a-f]{6}$'),
  deducts_vacation  boolean not null default false,
  requires_approval boolean not null default true,
  is_sick           boolean not null default false,
  position          integer not null default 0,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (tenant_id, id)
);
create unique index absence_types_name_idx on hr.absence_types (tenant_id, lower(name));

create table hr.vacation_adjustments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  employee_id uuid not null,
  year        smallint not null check (year between 2000 and 2100),
  days        numeric(5, 1) not null check (days between -100 and 100),
  reason      text not null check (char_length(btrim(reason)) between 1 and 200),
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, employee_id) references hr.employees(tenant_id, id) on delete cascade
);
create index vacation_adjustments_employee_idx on hr.vacation_adjustments (tenant_id, employee_id, year);

create table hr.public_holidays (
  tenant_id uuid not null references core.tenants(id) on delete cascade,
  date      date not null,
  name      text not null check (char_length(btrim(name)) between 1 and 80),
  primary key (tenant_id, date)
);

create table hr.absences (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  employee_id    uuid not null,
  type_id        uuid not null,
  start_date     date not null,
  end_date       date not null,
  half_day_start boolean not null default false,
  half_day_end   boolean not null default false,
  days           numeric(5, 1) not null default 0,
  status         text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  note           text check (char_length(note) <= 1000),
  decision_note  text check (char_length(decision_note) <= 1000),
  requested_by   uuid references auth.users(id) on delete set null default auth.uid(),
  decided_by     uuid references auth.users(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  check (end_date >= start_date and end_date - start_date <= 366),
  foreign key (tenant_id, employee_id) references hr.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, type_id) references hr.absence_types(tenant_id, id)
);
create index absences_employee_idx on hr.absences (tenant_id, employee_id, start_date);
create index absences_range_idx on hr.absences (tenant_id, start_date, end_date) where status in ('requested', 'approved');
create index absences_type_idx on hr.absences (tenant_id, type_id);
create index absences_requested_by_idx on hr.absences (requested_by);
create index absences_decided_by_idx on hr.absences (decided_by);

create table hr.onboarding_tasks (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null,
  employee_id        uuid not null,
  title              text not null check (char_length(btrim(title)) between 1 and 200),
  due_date           date,
  assignee_member_id uuid,
  done_at            timestamptz,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  foreign key (tenant_id, employee_id) references hr.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignee_member_id) references core.tenant_members(tenant_id, id) on delete set null (assignee_member_id)
);
create index onboarding_tasks_employee_idx on hr.onboarding_tasks (tenant_id, employee_id, position);
create index onboarding_tasks_assignee_idx on hr.onboarding_tasks (tenant_id, assignee_member_id) where assignee_member_id is not null;

-- -----------------------------------------------------------------------------
-- Zugriff
-- -----------------------------------------------------------------------------
create or replace function hr.my_employee_id(p_tenant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.id from hr.employees e join core.tenant_members m on m.id = e.member_id
  where e.tenant_id = p_tenant and m.user_id = (select auth.uid());
$$;

-- Direkte Führungskraft der Person?
create or replace function hr.is_manager_of(p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from hr.employees e
    where e.id = p_employee and e.manager_employee_id is not null
      and e.manager_employee_id = hr.my_employee_id(e.tenant_id)
      and core.can(e.tenant_id, 'hr.view')
  );
$$;

-- Details einer Abwesenheit (inkl. Art/Grund) sehen: die Person selbst, Führungskraft, hr.manage
create or replace function hr.can_see_absence_details(p_employee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from hr.employees e
    where e.id = p_employee
      and core.can(e.tenant_id, 'hr.view')
      and (e.id = hr.my_employee_id(e.tenant_id) or hr.is_manager_of(e.id) or core.can(e.tenant_id, 'hr.manage'))
  );
$$;

-- -----------------------------------------------------------------------------
-- Nummern, Standardwerte, Schutz
-- -----------------------------------------------------------------------------
create or replace function hr.assign_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_value bigint;
begin
  insert into hr.counters as c (tenant_id, next_value) values (new.tenant_id, 2)
  on conflict (tenant_id) do update set next_value = c.next_value + 1
  returning c.next_value - 1 into v_value;
  new.personnel_number := 'MA-' || lpad(v_value::text, 5, '0');
  return new;
end $$;
create trigger employees_number before insert on hr.employees
  for each row execute function hr.assign_number();

create or replace function hr.protect_employee()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.personnel_number := old.personnel_number;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.work_days := (select coalesce(array_agg(distinct d order by d), '{}') from unnest(new.work_days) d);
  -- Keine Kreise in der Vorgesetztenkette
  if new.manager_employee_id is not null and exists (
    with recursive chain(id) as (
      select e.manager_employee_id from hr.employees e where e.id = new.manager_employee_id
      union
      select e.manager_employee_id from hr.employees e join chain c on e.id = c.id where e.manager_employee_id is not null
    ) select 1 from chain where id = new.id
  ) then
    raise exception 'Diese Vorgesetztenzuordnung würde einen Kreis bilden' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger employees_protect before update on hr.employees
  for each row execute function hr.protect_employee();

create or replace function hr.setup_tenant(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into hr.absence_types (tenant_id, name, color, deducts_vacation, requires_approval, is_sick, position) values
    (p_tenant, 'Urlaub', '#10b981', true, true, false, 1),
    (p_tenant, 'Krankheit', '#ef4444', false, false, true, 2),
    (p_tenant, 'Sonderurlaub', '#8b5cf6', false, true, false, 3),
    (p_tenant, 'Fortbildung', '#0ea5e9', false, true, false, 4),
    (p_tenant, 'Überstundenabbau', '#f59e0b', false, true, false, 5)
  on conflict do nothing;
end $$;

create or replace function hr.on_module_enabled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.module_key = 'hr' and new.enabled then
    perform hr.setup_tenant(new.tenant_id);
  end if;
  return new;
end $$;
create trigger tenant_modules_hr_setup after insert or update of enabled on core.tenant_modules
  for each row execute function hr.on_module_enabled();

-- Arbeitstage im Zeitraum (Arbeitstage der Person, ohne Feiertage; halbe Tage am Rand)
create or replace function hr.count_days(p_employee uuid, p_start date, p_end date, p_half_start boolean, p_half_end boolean)
returns numeric language sql stable security definer set search_path = '' as $$
  with e as (select tenant_id, work_days from hr.employees where id = p_employee),
  d as (
    select day::date as day from generate_series(p_start, p_end, interval '1 day') day, e
    where extract(isodow from day)::smallint = any (e.work_days)
      and not exists (select 1 from hr.public_holidays h where h.tenant_id = e.tenant_id and h.date = day::date)
  )
  select greatest(0,
    count(*)::numeric
    - case when p_half_start and exists (select 1 from d where day = p_start) then 0.5 else 0 end
    - case when p_half_end and p_end <> p_start and exists (select 1 from d where day = p_end) then 0.5 else 0 end)
  from d;
$$;

create or replace function hr.prepare_absence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_type hr.absence_types;
begin
  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id;
    new.employee_id := old.employee_id;
    new.requested_by := old.requested_by;
    new.created_at := old.created_at;
  end if;
  if new.start_date = new.end_date and new.half_day_start and new.half_day_end then
    new.half_day_end := false;
  end if;
  new.days := hr.count_days(new.employee_id, new.start_date, new.end_date, new.half_day_start, new.half_day_end);

  select * into v_type from hr.absence_types where id = new.type_id;
  if tg_op = 'INSERT' and not v_type.requires_approval then
    new.status := 'approved';
    new.decided_at := now();
  end if;
  if new.status in ('requested', 'approved') and exists (
    select 1 from hr.absences a
    where a.employee_id = new.employee_id and a.id <> new.id and a.status in ('requested', 'approved')
      and a.start_date <= new.end_date and a.end_date >= new.start_date
  ) then
    raise exception 'Für diesen Zeitraum gibt es bereits eine Abwesenheit' using errcode = '23P01';
  end if;
  return new;
end $$;
create trigger absences_prepare before insert or update on hr.absences
  for each row execute function hr.prepare_absence();

create trigger employees_updated_at before update on hr.employees for each row execute function core.set_updated_at();
create trigger employee_private_updated_at before update on hr.employee_private for each row execute function core.set_updated_at();
create trigger absences_updated_at before update on hr.absences for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fachfunktionen
-- -----------------------------------------------------------------------------

-- Antrag stellen (für sich selbst; hr.manage auch für andere)
create or replace function hr.request_absence(
  p_employee uuid, p_type uuid, p_start date, p_end date, p_half_start boolean default false,
  p_half_end boolean default false, p_note text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_emp hr.employees;
  v_id  uuid;
begin
  select * into v_emp from hr.employees where id = p_employee;
  if not found or not core.can(v_emp.tenant_id, 'hr.view') then
    raise exception 'Mitarbeiter nicht gefunden' using errcode = 'P0002';
  end if;
  if not ((v_emp.id = hr.my_employee_id(v_emp.tenant_id) and core.can(v_emp.tenant_id, 'hr.absences.request'))
          or core.can(v_emp.tenant_id, 'hr.manage')) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if not exists (select 1 from hr.absence_types where id = p_type and tenant_id = v_emp.tenant_id and archived_at is null) then
    raise exception 'Unbekannte Abwesenheitsart' using errcode = '23503';
  end if;
  insert into hr.absences (tenant_id, employee_id, type_id, start_date, end_date, half_day_start, half_day_end, note)
  values (v_emp.tenant_id, p_employee, p_type, p_start, p_end, coalesce(p_half_start, false), coalesce(p_half_end, false),
          nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Genehmigen/Ablehnen: direkte Führungskraft oder hr.manage (eigene Anträge nur mit hr.manage)
create or replace function hr.decide_absence(p_absence uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_abs hr.absences;
begin
  select * into v_abs from hr.absences where id = p_absence;
  if not found or not hr.can_see_absence_details(v_abs.employee_id) then
    raise exception 'Antrag nicht gefunden' using errcode = 'P0002';
  end if;
  if not (core.can(v_abs.tenant_id, 'hr.manage') or hr.is_manager_of(v_abs.employee_id)) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_abs.status <> 'requested' then
    raise exception 'Der Antrag wurde bereits entschieden' using errcode = '22023';
  end if;
  update hr.absences
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_by = (select auth.uid()), decided_at = now(), decision_note = nullif(btrim(p_note), '')
  where id = p_absence;
end $$;

-- Zurückziehen: die Person selbst (solange nicht begonnen), Führungskraft oder hr.manage
create or replace function hr.cancel_absence(p_absence uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_abs hr.absences;
  v_own boolean;
begin
  select * into v_abs from hr.absences where id = p_absence;
  if not found or not hr.can_see_absence_details(v_abs.employee_id) then
    raise exception 'Antrag nicht gefunden' using errcode = 'P0002';
  end if;
  v_own := v_abs.employee_id = hr.my_employee_id(v_abs.tenant_id);
  if not (core.can(v_abs.tenant_id, 'hr.manage') or hr.is_manager_of(v_abs.employee_id)
          or (v_own and (v_abs.status = 'requested' or v_abs.start_date > (now() at time zone (select timezone from core.tenants where id = v_abs.tenant_id))::date))) then
    raise exception 'Begonnene Abwesenheiten kann nur die Führungskraft oder die Personalabteilung zurücknehmen' using errcode = '42501';
  end if;
  if v_abs.status not in ('requested', 'approved') then
    raise exception 'Der Antrag ist nicht mehr aktiv' using errcode = '22023';
  end if;
  update hr.absences set status = 'cancelled' where id = p_absence;
end $$;

-- Urlaubskonto eines Jahres
create or replace function hr.vacation_balance(p_employee uuid, p_year integer)
returns table (entitlement numeric, adjustments numeric, taken numeric, planned numeric, remaining numeric)
language sql stable security definer set search_path = '' as $$
  with e as (
    select * from hr.employees where id = p_employee and hr.can_see_absence_details(id)
  ),
  ent as (
    -- Anteilig im Eintritts-/Austrittsjahr (volle Monate), auf halbe Tage gerundet
    select round(e.vacation_days * (
             (least(12, case when extract(year from e.exit_date) = p_year then extract(month from e.exit_date) else 12 end)
              - greatest(1, case when extract(year from e.entry_date) = p_year then extract(month from e.entry_date) else 1 end) + 1)
             / 12.0) * 2) / 2 as days
    from e
    where (e.entry_date is null or extract(year from e.entry_date) <= p_year)
      and (e.exit_date is null or extract(year from e.exit_date) >= p_year)
  ),
  adj as (select coalesce(sum(days), 0) as days from hr.vacation_adjustments where employee_id = p_employee and year = p_year),
  used as (
    select coalesce(sum(a.days) filter (where a.status = 'approved'), 0) as taken,
           coalesce(sum(a.days) filter (where a.status = 'requested'), 0) as planned
    from hr.absences a join hr.absence_types t on t.id = a.type_id
    where a.employee_id = p_employee and t.deducts_vacation and extract(year from a.start_date) = p_year
  )
  select coalesce((select days from ent), 0), adj.days, used.taken, used.planned,
         coalesce((select days from ent), 0) + adj.days - used.taken - used.planned
  from adj, used
  where exists (select 1 from e);
$$;

-- Abwesenheitsübersicht (genehmigt und beantragt); Art nur für Berechtigte, sonst „Abwesend“
create or replace function hr.absence_overview(p_tenant uuid, p_from date, p_to date)
returns table (absence_id uuid, employee_id uuid, employee_name text, start_date date, end_date date,
               status text, label text, color text, days numeric, details_visible boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, e.id, e.first_name || ' ' || e.last_name, a.start_date, a.end_date, a.status,
         case when hr.can_see_absence_details(e.id) then t.name else 'Abwesend' end,
         case when hr.can_see_absence_details(e.id) then t.color else '#94a3b8' end,
         a.days, hr.can_see_absence_details(e.id)
  from hr.absences a
  join hr.employees e on e.id = a.employee_id
  join hr.absence_types t on t.id = a.type_id
  where a.tenant_id = p_tenant
    and core.can(p_tenant, 'hr.view')
    and a.status in ('requested', 'approved')
    and (a.status = 'approved' or hr.can_see_absence_details(e.id))
    and a.start_date < p_to and a.end_date >= p_from
    and p_to - p_from <= 400
  order by a.start_date, e.last_name;
$$;

-- -----------------------------------------------------------------------------
-- Protokoll (ohne vertrauliche Inhalte), Suche (Verzeichnis), Benachrichtigungen
-- -----------------------------------------------------------------------------
create or replace function hr.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row  jsonb := to_jsonb(coalesce(new, old));
  v_meta jsonb := '{}';
  v_name text;
begin
  if not exists (select 1 from core.tenants where id = (v_row ->> 'tenant_id')::uuid) then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'employees' then
    v_meta := jsonb_build_object('number', v_row ->> 'personnel_number', 'name', (v_row ->> 'first_name') || ' ' || (v_row ->> 'last_name'));
  elsif tg_table_name = 'employee_private' then
    select personnel_number into v_name from hr.employees where id = (v_row ->> 'employee_id')::uuid;
    v_meta := jsonb_build_object('number', v_name);
  elsif tg_table_name = 'absences' then
    if tg_op = 'UPDATE' and (new.status is not distinct from old.status) then
      return new;
    end if;
    select personnel_number into v_name from hr.employees where id = (v_row ->> 'employee_id')::uuid;
    v_meta := jsonb_build_object('number', v_name, 'status', v_row ->> 'status');
  elsif tg_table_name = 'vacation_adjustments' then
    select personnel_number into v_name from hr.employees where id = (v_row ->> 'employee_id')::uuid;
    v_meta := jsonb_build_object('number', v_name, 'days', v_row ->> 'days', 'year', v_row ->> 'year');
  end if;
  perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'hr.' || tg_table_name || '.' || lower(tg_op), tg_table_name,
                         coalesce(v_row ->> 'id', v_row ->> 'employee_id'), v_meta);
  return coalesce(new, old);
end $$;
create trigger employees_audit after insert or update or delete on hr.employees for each row execute function hr.write_audit_log();
create trigger employee_private_audit after insert or update or delete on hr.employee_private for each row execute function hr.write_audit_log();
create trigger absences_audit after insert or update or delete on hr.absences for each row execute function hr.write_audit_log();
create trigger vacation_adjustments_audit after insert or delete on hr.vacation_adjustments for each row execute function hr.write_audit_log();

create or replace function hr.search_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform core.search_remove('employee', old.id);
    return old;
  end if;
  perform core.search_upsert(new.tenant_id, 'employee', new.id, new.first_name || ' ' || new.last_name,
    concat_ws(' · ', new.personnel_number, new.position, new.work_email), 'personal/mitarbeiter/' || new.id, 'hr.view');
  return new;
end $$;
create trigger employees_search after insert or update or delete on hr.employees for each row execute function hr.search_sync();

create or replace function hr.notify_absence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_emp  hr.employees;
  v_type text;
  v_user uuid;
  v_text text;
begin
  select * into v_emp from hr.employees where id = new.employee_id;
  select name into v_type from hr.absence_types where id = new.type_id;
  v_text := to_char(new.start_date, 'DD.MM.YYYY') || case when new.end_date <> new.start_date then ' – ' || to_char(new.end_date, 'DD.MM.YYYY') else '' end;

  if tg_op = 'INSERT' and new.status = 'requested' then
    -- Führungskraft informieren, sonst die Personalverwaltung (Admins)
    select m.user_id into v_user from hr.employees mgr join core.tenant_members m on m.id = mgr.member_id
    where mgr.id = v_emp.manager_employee_id;
    if v_user is not null and v_user is distinct from (select auth.uid()) then
      perform core.notify(new.tenant_id, v_user, 'hr.absence.requested',
        v_emp.first_name || ' ' || v_emp.last_name || ' beantragt ' || v_type, v_text, 'personal/abwesenheiten');
    elsif v_user is null then
      perform core.notify_role(new.tenant_id, 'admin', 'hr.absence.requested',
        v_emp.first_name || ' ' || v_emp.last_name || ' beantragt ' || v_type, v_text, 'personal/abwesenheiten', (select auth.uid()));
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    select m.user_id into v_user from core.tenant_members m where m.id = v_emp.member_id;
    if v_user is not null and v_user is distinct from (select auth.uid()) then
      perform core.notify(new.tenant_id, v_user, 'hr.absence.decided',
        v_type || case when new.status = 'approved' then ' genehmigt' else ' abgelehnt' end, v_text, 'personal/abwesenheiten');
    end if;
  end if;
  return new;
end $$;
create trigger absences_notify after insert or update of status on hr.absences for each row execute function hr.notify_absence();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table hr.counters enable row level security;
alter table hr.employees enable row level security;
alter table hr.employee_private enable row level security;
alter table hr.absence_types enable row level security;
alter table hr.vacation_adjustments enable row level security;
alter table hr.public_holidays enable row level security;
alter table hr.absences enable row level security;
alter table hr.onboarding_tasks enable row level security;

create policy employees_select on hr.employees for select to authenticated using (core.can(tenant_id, 'hr.view'));
create policy employees_insert on hr.employees for insert to authenticated with check (core.can(tenant_id, 'hr.manage'));
create policy employees_update on hr.employees for update to authenticated
  using (core.can(tenant_id, 'hr.manage')) with check (core.can(tenant_id, 'hr.manage'));
create policy employees_delete on hr.employees for delete to authenticated using (core.can(tenant_id, 'hr.manage'));

create policy employee_private_select on hr.employee_private for select to authenticated using (core.can(tenant_id, 'hr.sensitive'));
create policy employee_private_insert on hr.employee_private for insert to authenticated with check (core.can(tenant_id, 'hr.sensitive'));
create policy employee_private_update on hr.employee_private for update to authenticated
  using (core.can(tenant_id, 'hr.sensitive')) with check (core.can(tenant_id, 'hr.sensitive'));
create policy employee_private_delete on hr.employee_private for delete to authenticated using (core.can(tenant_id, 'hr.sensitive'));

create policy absence_types_select on hr.absence_types for select to authenticated using (core.can(tenant_id, 'hr.view'));
create policy absence_types_insert on hr.absence_types for insert to authenticated with check (core.can(tenant_id, 'hr.manage'));
create policy absence_types_update on hr.absence_types for update to authenticated
  using (core.can(tenant_id, 'hr.manage')) with check (core.can(tenant_id, 'hr.manage'));

create policy public_holidays_select on hr.public_holidays for select to authenticated using (core.can(tenant_id, 'hr.view'));
create policy public_holidays_insert on hr.public_holidays for insert to authenticated with check (core.can(tenant_id, 'hr.manage'));
create policy public_holidays_delete on hr.public_holidays for delete to authenticated using (core.can(tenant_id, 'hr.manage'));

create policy vacation_adjustments_select on hr.vacation_adjustments for select to authenticated using (hr.can_see_absence_details(employee_id));
create policy vacation_adjustments_insert on hr.vacation_adjustments for insert to authenticated
  with check (core.can(tenant_id, 'hr.manage') and created_by = (select auth.uid()));
create policy vacation_adjustments_delete on hr.vacation_adjustments for delete to authenticated using (core.can(tenant_id, 'hr.manage'));

-- Abwesenheiten: lesen mit Details-Recht; anlegen/entscheiden nur über die Funktionen;
-- Notizen ändern und löschen mit hr.manage
create policy absences_select on hr.absences for select to authenticated using (hr.can_see_absence_details(employee_id));
create policy absences_update on hr.absences for update to authenticated
  using (core.can(tenant_id, 'hr.manage')) with check (core.can(tenant_id, 'hr.manage'));
create policy absences_delete on hr.absences for delete to authenticated using (core.can(tenant_id, 'hr.manage'));

create policy onboarding_select on hr.onboarding_tasks for select to authenticated
  using (core.can(tenant_id, 'hr.manage') or hr.is_manager_of(employee_id)
         or employee_id = hr.my_employee_id(tenant_id)
         or (assignee_member_id is not null and assignee_member_id = (select m.id from core.tenant_members m
                                                                      where m.tenant_id = onboarding_tasks.tenant_id and m.user_id = (select auth.uid()))));
create policy onboarding_insert on hr.onboarding_tasks for insert to authenticated with check (core.can(tenant_id, 'hr.manage'));
create policy onboarding_update on hr.onboarding_tasks for update to authenticated
  using (core.can(tenant_id, 'hr.manage') or (assignee_member_id is not null and assignee_member_id = (select m.id from core.tenant_members m
                                                                      where m.tenant_id = onboarding_tasks.tenant_id and m.user_id = (select auth.uid()))))
  with check (core.can(tenant_id, 'hr.view'));
create policy onboarding_delete on hr.onboarding_tasks for delete to authenticated using (core.can(tenant_id, 'hr.manage'));

-- =============================================================================
-- Rechte
-- =============================================================================
grant select, insert, update, delete on hr.employees, hr.employee_private, hr.vacation_adjustments, hr.onboarding_tasks to authenticated;
grant select, insert, update on hr.absence_types to authenticated;
grant select, insert, delete on hr.public_holidays to authenticated;
grant select, update, delete on hr.absences to authenticated;
grant all on all tables in schema hr to service_role;

revoke all on function hr.assign_number(), hr.protect_employee(), hr.setup_tenant(uuid), hr.on_module_enabled(),
  hr.prepare_absence(), hr.write_audit_log(), hr.search_sync(), hr.notify_absence() from public, anon, authenticated;
revoke all on function hr.my_employee_id(uuid), hr.is_manager_of(uuid), hr.can_see_absence_details(uuid),
  hr.count_days(uuid, date, date, boolean, boolean), hr.request_absence(uuid, uuid, date, date, boolean, boolean, text),
  hr.decide_absence(uuid, boolean, text), hr.cancel_absence(uuid), hr.vacation_balance(uuid, integer),
  hr.absence_overview(uuid, date, date) from public, anon;
grant execute on function hr.my_employee_id(uuid), hr.is_manager_of(uuid), hr.can_see_absence_details(uuid),
  hr.count_days(uuid, date, date, boolean, boolean), hr.request_absence(uuid, uuid, date, date, boolean, boolean, text),
  hr.decide_absence(uuid, boolean, text), hr.cancel_absence(uuid), hr.vacation_balance(uuid, integer),
  hr.absence_overview(uuid, date, date) to authenticated;

-- =============================================================================
-- Bestehende Unternehmen erhalten das Modul
-- =============================================================================
insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select id, 'hr', true, 'included' from core.tenants
on conflict (tenant_id, module_key) do nothing;
select hr.setup_tenant(id) from core.tenants;
