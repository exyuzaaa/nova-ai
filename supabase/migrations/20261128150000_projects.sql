-- =============================================================================
-- NOVA Projekte – Projekte, Mitglieder, Status, Meilensteine, Aufgaben,
-- Unteraufgaben, Checklisten, Abhängigkeiten, Kommentare, Zeiterfassung
-- (Plattform-Phase 2b)
-- -----------------------------------------------------------------------------
-- Grundsätze
--   * Jede Zeile trägt tenant_id; Verweise laufen über (tenant_id, …, id).
--     Aufgaben, Status, Meilensteine, Checklisten, Abhängigkeiten, Kommentare
--     tragen zusätzlich project_id – alles bleibt im selben Projekt.
--   * Sichtbarkeit: „Unternehmen“ (alle mit projects.view) oder „Projektmitglieder“
--     (nur Mitglieder des Projekts und projects.manage).
--   * Rechte: projects.view (lesen), projects.edit (Projekte anlegen, Aufgaben
--     bearbeiten), projects.time (eigene Zeiten), projects.time_all (alle Zeiten),
--     projects.manage (alle Projekte, löschen, Vorlagen).
--     Projekteinstellungen (Mitglieder, Status, Meilensteine) ändern Projektleitung
--     und projects.manage.
--   * Archivierte Projekte sind schreibgeschützt.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Modul und Rechte
-- -----------------------------------------------------------------------------
update core.modules set status = 'available', enabled_by_default = true where key = 'projects';

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('projects.view',     'projects', 'Projekte ansehen',          'Projekte, Aufgaben, Meilensteine und Kommentare (sichtbare Projekte).', 'viewer', true, false, 10),
  ('projects.edit',     'projects', 'Projekte bearbeiten',       'Projekte anlegen, Aufgaben anlegen, ändern und kommentieren.',          'member', true, false, 20),
  ('projects.time',     'projects', 'Zeiten erfassen',           'Eigene Arbeitszeiten auf Projekte und Aufgaben buchen.',               'member', true, false, 30),
  ('projects.time_all', 'projects', 'Alle Zeiten verwalten',     'Zeiten aller Personen sehen, korrigieren und auswerten.',              'admin',  true, true,  40),
  ('projects.manage',   'projects', 'Projekte verwalten',        'Alle Projekte sehen und einrichten, Projekte löschen, Vorlagen.',      'admin',  true, false, 50);

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table projects.counters (
  tenant_id  uuid not null references core.tenants(id) on delete cascade,
  scope      uuid not null,           -- tenant_id für Projektnummern, project_id für Aufgabennummern
  next_value bigint not null default 1 check (next_value > 0),
  primary key (tenant_id, scope)
);

create table projects.projects (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references core.tenants(id) on delete cascade,
  number         text not null default '',  -- vergibt projects.assign_project_number()
  name           text not null check (char_length(btrim(name)) between 1 and 200),
  description    text check (char_length(description) <= 10000),
  customer_id    uuid,
  status         text not null default 'active' check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  visibility     text not null default 'tenant' check (visibility in ('tenant', 'members')),
  color          text not null default '#6366f1' check (color ~ '^#[0-9a-f]{6}$'),
  start_date     date,
  due_date       date,
  budget_hours   numeric(10, 2) check (budget_hours >= 0),
  lead_member_id uuid,
  is_template    boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, number),
  check (due_date is null or start_date is null or due_date >= start_date),
  foreign key (tenant_id, customer_id) references crm.customers(tenant_id, id) on delete set null (customer_id),
  foreign key (tenant_id, lead_member_id) references core.tenant_members(tenant_id, id) on delete set null (lead_member_id)
);
create index projects_tenant_status_idx on projects.projects (tenant_id, status) where archived_at is null;
create index projects_customer_idx on projects.projects (tenant_id, customer_id) where customer_id is not null;
create index projects_lead_idx on projects.projects (tenant_id, lead_member_id) where lead_member_id is not null;
create index projects_created_by_idx on projects.projects (created_by);

create table projects.project_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  project_id uuid not null,
  member_id  uuid not null,
  role       text not null default 'member' check (role in ('manager', 'member')),
  created_at timestamptz not null default now(),
  unique (project_id, member_id),
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete cascade
);
create index project_members_member_idx on projects.project_members (tenant_id, member_id);
create index project_members_project_idx on projects.project_members (tenant_id, project_id);

create table projects.statuses (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  project_id uuid not null,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  category   text not null default 'todo' check (category in ('todo', 'in_progress', 'done')),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, project_id, id),
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete cascade
);
create index statuses_project_idx on projects.statuses (tenant_id, project_id, position);

create table projects.milestones (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  project_id   uuid not null,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  description  text check (char_length(description) <= 2000),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, project_id, id),
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete cascade
);
create index milestones_project_idx on projects.milestones (tenant_id, project_id, due_date);

create table projects.tasks (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null,
  project_id           uuid not null,
  number               integer not null default 0,  -- vergibt projects.assign_task_number()
  parent_id            uuid,
  title                text not null check (char_length(btrim(title)) between 1 and 300),
  description          text check (char_length(description) <= 20000),
  status_id            uuid not null,
  priority             text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee_member_id   uuid,
  start_date           date,
  due_date             date,
  estimate_minutes     integer check (estimate_minutes between 0 and 100000),
  milestone_id         uuid,
  position             double precision not null default 0,
  completed_at         timestamptz,
  reminder_notified_at timestamptz,
  created_by           uuid references auth.users(id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, project_id, id),
  unique (project_id, number),
  check (due_date is null or start_date is null or due_date >= start_date),
  check (parent_id is distinct from id),
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, project_id, status_id) references projects.statuses(tenant_id, project_id, id),
  foreign key (tenant_id, project_id, parent_id) references projects.tasks(tenant_id, project_id, id) on delete cascade,
  foreign key (tenant_id, project_id, milestone_id) references projects.milestones(tenant_id, project_id, id) on delete set null (milestone_id),
  foreign key (tenant_id, assignee_member_id) references core.tenant_members(tenant_id, id) on delete set null (assignee_member_id)
);
create index tasks_project_status_idx on projects.tasks (tenant_id, project_id, status_id, position);
create index tasks_status_fk_idx on projects.tasks (tenant_id, status_id);
create index tasks_parent_idx on projects.tasks (tenant_id, project_id, parent_id) where parent_id is not null;
create index tasks_milestone_idx on projects.tasks (tenant_id, project_id, milestone_id) where milestone_id is not null;
create index tasks_assignee_idx on projects.tasks (tenant_id, assignee_member_id) where assignee_member_id is not null;
create index tasks_due_idx on projects.tasks (due_date) where completed_at is null and reminder_notified_at is null;
create index tasks_created_by_idx on projects.tasks (created_by);

create table projects.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  project_id uuid not null,
  task_id    uuid not null,
  title      text not null check (char_length(btrim(title)) between 1 and 300),
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, project_id, task_id) references projects.tasks(tenant_id, project_id, id) on delete cascade
);
create index checklist_items_task_idx on projects.checklist_items (tenant_id, project_id, task_id, position);

create table projects.task_dependencies (
  tenant_id     uuid not null,
  project_id    uuid not null,
  task_id       uuid not null,  -- diese Aufgabe …
  depends_on_id uuid not null,  -- … wartet auf diese
  created_at    timestamptz not null default now(),
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id),
  foreign key (tenant_id, project_id, task_id) references projects.tasks(tenant_id, project_id, id) on delete cascade,
  foreign key (tenant_id, project_id, depends_on_id) references projects.tasks(tenant_id, project_id, id) on delete cascade
);
create index task_dependencies_task_idx on projects.task_dependencies (tenant_id, project_id, task_id);
create index task_dependencies_depends_idx on projects.task_dependencies (tenant_id, project_id, depends_on_id);

create table projects.comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  project_id uuid not null,
  task_id    uuid not null,
  author_id  uuid references auth.users(id) on delete set null default auth.uid(),
  body       text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at  timestamptz,
  foreign key (tenant_id, project_id, task_id) references projects.tasks(tenant_id, project_id, id) on delete cascade
);
create index comments_task_idx on projects.comments (tenant_id, project_id, task_id, created_at);
create index comments_author_idx on projects.comments (author_id);

create table projects.time_entries (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  project_id       uuid not null,
  task_id          uuid,
  member_id        uuid,  -- bleibt nach Austritt leer stehen; die Zeit gehört dem Unternehmen
  user_id          uuid references auth.users(id) on delete set null default auth.uid(),
  started_at       timestamptz not null,
  ended_at         timestamptz,  -- leer: Stoppuhr läuft
  duration_minutes integer generated always as (
                     case when ended_at is null then null
                          else greatest(1, ceil(extract(epoch from (ended_at - started_at)) / 60))::integer end
                   ) stored,
  note             text check (char_length(note) <= 1000),
  billable         boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ended_at is null or (ended_at > started_at and ended_at - started_at <= interval '24 hours')),
  foreign key (tenant_id, project_id) references projects.projects(tenant_id, id) on delete cascade,
  foreign key (tenant_id, project_id, task_id) references projects.tasks(tenant_id, project_id, id) on delete set null (task_id),
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete set null (member_id)
);
-- Höchstens eine laufende Stoppuhr je Person
create unique index time_entries_one_running_idx on projects.time_entries (member_id) where ended_at is null;
create index time_entries_project_idx on projects.time_entries (tenant_id, project_id, started_at desc);
create index time_entries_task_idx on projects.time_entries (tenant_id, project_id, task_id) where task_id is not null;
create index time_entries_member_idx on projects.time_entries (tenant_id, member_id, started_at desc);
create index time_entries_user_idx on projects.time_entries (user_id);

-- -----------------------------------------------------------------------------
-- Zugriffsfunktionen (SECURITY DEFINER, damit RLS-Policies sich nicht gegenseitig
-- aufrufen; geprüft wird immer core.can() für den angemeldeten Nutzer)
-- -----------------------------------------------------------------------------
create or replace function projects.my_member_id(p_tenant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from core.tenant_members m where m.tenant_id = p_tenant and m.user_id = (select auth.uid());
$$;

create or replace function projects.project_role(p_project uuid)
returns text language sql stable security definer set search_path = '' as $$
  select pm.role from projects.project_members pm
  join core.tenant_members m on m.id = pm.member_id
  where pm.project_id = p_project and m.user_id = (select auth.uid());
$$;

-- Projekt sehen: Recht + (offen sichtbar, Mitglied oder projects.manage)
create or replace function projects.can_view(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from projects.projects p
    where p.id = p_project
      and core.can(p.tenant_id, 'projects.view')
      and (p.visibility = 'tenant' or core.can(p.tenant_id, 'projects.manage') or projects.project_role(p.id) is not null)
  );
$$;

-- Aufgaben bearbeiten: projects.edit + sichtbar + nicht archiviert
create or replace function projects.can_edit(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from projects.projects p
    where p.id = p_project
      and p.archived_at is null
      and core.can(p.tenant_id, 'projects.edit')
      and (p.visibility = 'tenant' or core.can(p.tenant_id, 'projects.manage') or projects.project_role(p.id) is not null)
  );
$$;

-- Projekt einrichten (Stammdaten, Mitglieder, Status, Meilensteine): Projektleitung oder projects.manage
create or replace function projects.can_manage(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from projects.projects p
    where p.id = p_project
      and (core.can(p.tenant_id, 'projects.manage')
           or (core.can(p.tenant_id, 'projects.edit') and projects.project_role(p.id) = 'manager'))
  );
$$;

-- -----------------------------------------------------------------------------
-- Nummern, Schutz, Standardwerte
-- -----------------------------------------------------------------------------
create or replace function projects.next_value(p_tenant uuid, p_scope uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_value bigint;
begin
  insert into projects.counters as c (tenant_id, scope, next_value) values (p_tenant, p_scope, 2)
  on conflict (tenant_id, scope) do update set next_value = c.next_value + 1
  returning c.next_value - 1 into v_value;
  return v_value;
end $$;

create or replace function projects.assign_project_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.number := 'P-' || lpad(projects.next_value(new.tenant_id, new.tenant_id)::text, 5, '0');
  return new;
end $$;
create trigger projects_number before insert on projects.projects
  for each row execute function projects.assign_project_number();

create or replace function projects.protect_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.number := old.number;
  new.tenant_id := old.tenant_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  -- Vorlage ↔ Projekt umschalten nur mit projects.manage
  if new.is_template is distinct from old.is_template and current_user = 'authenticated'
     and not core.can(old.tenant_id, 'projects.manage') then
    new.is_template := old.is_template;
  end if;
  return new;
end $$;
create trigger projects_protect before update on projects.projects
  for each row execute function projects.protect_project();

-- Neues Projekt: Standardstatus und Ersteller als Projektleitung
create or replace function projects.setup_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
begin
  insert into projects.statuses (tenant_id, project_id, name, category, position) values
    (new.tenant_id, new.id, 'Offen', 'todo', 1),
    (new.tenant_id, new.id, 'In Arbeit', 'in_progress', 2),
    (new.tenant_id, new.id, 'Prüfung', 'in_progress', 3),
    (new.tenant_id, new.id, 'Erledigt', 'done', 4);
  v_member := projects.my_member_id(new.tenant_id);
  if v_member is not null then
    insert into projects.project_members (tenant_id, project_id, member_id, role)
    values (new.tenant_id, new.id, v_member, 'manager');
  end if;
  if new.lead_member_id is not null and new.lead_member_id is distinct from v_member then
    insert into projects.project_members (tenant_id, project_id, member_id, role)
    values (new.tenant_id, new.id, new.lead_member_id, 'manager')
    on conflict (project_id, member_id) do update set role = 'manager';
  end if;
  return new;
end $$;
create trigger projects_setup after insert on projects.projects
  for each row execute function projects.setup_project();

-- Projektleitung geändert → Person wird Mitglied mit Leitungsrolle
create or replace function projects.sync_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_member_id is not null and new.lead_member_id is distinct from old.lead_member_id then
    insert into projects.project_members (tenant_id, project_id, member_id, role)
    values (new.tenant_id, new.id, new.lead_member_id, 'manager')
    on conflict (project_id, member_id) do update set role = 'manager';
  end if;
  return new;
end $$;
create trigger projects_sync_lead after update of lead_member_id on projects.projects
  for each row execute function projects.sync_lead();

-- Mindestens eine Projektleitung bleibt (außer beim Löschen des Projekts)
create or replace function projects.protect_last_manager()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.role <> 'manager' or (tg_op = 'UPDATE' and new.role = 'manager') then
    return coalesce(new, old);
  end if;
  -- Projekt gelöscht oder Person hat das Unternehmen verlassen: kein Schutz nötig
  if not exists (select 1 from projects.projects where id = old.project_id)
     or not exists (select 1 from core.tenant_members where id = old.member_id) then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from projects.project_members
                 where project_id = old.project_id and role = 'manager' and id <> old.id) then
    raise exception 'Ein Projekt braucht mindestens eine Projektleitung' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger project_members_protect before update or delete on projects.project_members
  for each row execute function projects.protect_last_manager();

create or replace function projects.protect_member_row()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.project_id := old.project_id;
  new.member_id := old.member_id;
  return new;
end $$;
create trigger project_members_keep before update on projects.project_members
  for each row execute function projects.protect_member_row();

-- Status: letzter „Erledigt“- bzw. „Offen“-Status bleibt; Status mit Aufgaben schützt der Fremdschlüssel
create or replace function projects.protect_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id;
    new.project_id := old.project_id;
  end if;
  if not exists (select 1 from projects.projects where id = old.project_id) then
    return coalesce(new, old);
  end if;
  if (tg_op = 'DELETE' or new.category <> old.category) and old.category in ('todo', 'done')
     and not exists (select 1 from projects.statuses
                     where project_id = old.project_id and category = old.category and id <> old.id) then
    raise exception 'Ein Projekt braucht mindestens einen Status „%“', case old.category when 'todo' then 'Offen' else 'Erledigt' end
      using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;
create trigger statuses_protect before update or delete on projects.statuses
  for each row execute function projects.protect_status();

-- Aufgaben: Nummer je Projekt, nur eine Ebene Unteraufgaben, Erledigt-Zeitpunkt
create or replace function projects.prepare_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_category text;
begin
  if tg_op = 'INSERT' then
    new.number := projects.next_value(new.tenant_id, new.project_id);
  else
    new.number := old.number;
    new.tenant_id := old.tenant_id;
    new.project_id := old.project_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if current_user = 'authenticated' then
      new.reminder_notified_at := case when new.due_date is distinct from old.due_date then null
                                       else old.reminder_notified_at end;
    end if;
  end if;

  if new.parent_id is not null then
    if exists (select 1 from projects.tasks where id = new.parent_id and parent_id is not null) then
      raise exception 'Unteraufgaben können keine eigenen Unteraufgaben haben' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from projects.tasks where parent_id = new.id) then
      raise exception 'Eine Aufgabe mit Unteraufgaben kann keine Unteraufgabe werden' using errcode = '23514';
    end if;
  end if;

  select category into v_category from projects.statuses where id = new.status_id;
  if v_category = 'done' then
    new.completed_at := case when tg_op = 'UPDATE' then coalesce(old.completed_at, now()) else now() end;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger tasks_prepare before insert or update on projects.tasks
  for each row execute function projects.prepare_task();

-- Abhängigkeiten ohne Kreis
create or replace function projects.check_dependency()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    with recursive chain(id) as (
      select d.depends_on_id from projects.task_dependencies d where d.task_id = new.depends_on_id
      union
      select d.depends_on_id from projects.task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'Diese Abhängigkeit würde einen Kreis bilden' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger task_dependencies_check before insert or update on projects.task_dependencies
  for each row execute function projects.check_dependency();

-- Kommentare: Verfasser und Aufgabe bleiben, Bearbeitung wird vermerkt
create or replace function projects.protect_comment()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.project_id := old.project_id;
  new.task_id := old.task_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger comments_protect before update on projects.comments
  for each row execute function projects.protect_comment();

-- Zeiten: Person wird aus der Anmeldung gesetzt (nur mit projects.time_all für andere)
create or replace function projects.prepare_time_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    if new.member_id is distinct from old.member_id and current_user = 'authenticated'
       and not core.can(old.tenant_id, 'projects.time_all') then
      new.member_id := old.member_id;
    end if;
    return new;
  end if;
  if new.member_id is null or current_user <> 'authenticated' or not core.can(new.tenant_id, 'projects.time_all') then
    new.member_id := coalesce(projects.my_member_id(new.tenant_id), new.member_id);
  end if;
  if current_user = 'authenticated' then
    new.user_id := coalesce((select m.user_id from core.tenant_members m where m.id = new.member_id), (select auth.uid()));
  end if;
  return new;
end $$;
create trigger time_entries_prepare before insert or update on projects.time_entries
  for each row execute function projects.prepare_time_entry();

create trigger projects_updated_at before update on projects.projects for each row execute function core.set_updated_at();
create trigger statuses_updated_at before update on projects.statuses for each row execute function core.set_updated_at();
create trigger milestones_updated_at before update on projects.milestones for each row execute function core.set_updated_at();
create trigger tasks_updated_at before update on projects.tasks for each row execute function core.set_updated_at();
create trigger checklist_items_updated_at before update on projects.checklist_items for each row execute function core.set_updated_at();
create trigger comments_updated_at before update on projects.comments for each row execute function core.set_updated_at();
create trigger time_entries_updated_at before update on projects.time_entries for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Protokoll
-- -----------------------------------------------------------------------------
create or replace function projects.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row  jsonb := to_jsonb(coalesce(new, old));
  v_old  jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_meta jsonb;
begin
  if not exists (select 1 from core.tenants where id = (v_row ->> 'tenant_id')::uuid) then
    return coalesce(new, old);
  end if;
  -- Mitlöschen beim Entfernen eines Projekts und Grundstatus neuer Projekte nicht protokollieren
  if tg_table_name <> 'projects' and v_row ? 'project_id' then
    if tg_op = 'DELETE' and not exists (select 1 from projects.projects where id = (v_row ->> 'project_id')::uuid) then
      return old;
    end if;
    if tg_op = 'INSERT' and tg_table_name in ('statuses', 'project_members')
       and exists (select 1 from projects.projects where id = (v_row ->> 'project_id')::uuid and created_at = now()) then
      return new;
    end if;
  end if;
  -- Zeiten: nur Änderungen durch andere Personen (Korrekturen) protokollieren
  if tg_table_name = 'time_entries' and (v_row ->> 'user_id')::uuid is not distinct from (select auth.uid()) then
    return coalesce(new, old);
  end if;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'number', v_row ->> 'number',
    'name', coalesce(v_row ->> 'name', v_row ->> 'title'),
    'status', v_row ->> 'status',
    'role', v_row ->> 'role',
    'previous_role', v_old ->> 'role',
    'member_id', v_row ->> 'member_id',
    'project_id', v_row ->> 'project_id',
    'minutes', v_row ->> 'duration_minutes'));
  perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'projects.' || tg_table_name || '.' || lower(tg_op), tg_table_name,
                         v_row ->> 'id', v_meta);
  return coalesce(new, old);
end $$;
create trigger projects_audit after insert or update or delete on projects.projects
  for each row execute function projects.write_audit_log();
create trigger project_members_audit after insert or update or delete on projects.project_members
  for each row execute function projects.write_audit_log();
create trigger statuses_audit after insert or update or delete on projects.statuses
  for each row execute function projects.write_audit_log();
create trigger milestones_audit after insert or delete on projects.milestones
  for each row execute function projects.write_audit_log();
create trigger tasks_audit after insert or delete on projects.tasks
  for each row execute function projects.write_audit_log();
create trigger time_entries_audit after update or delete on projects.time_entries
  for each row execute function projects.write_audit_log();

-- -----------------------------------------------------------------------------
-- Suche: nur offen sichtbare, nicht archivierte Projekte (keine Vorlagen) und deren
-- Aufgaben. Projekte nur für Mitglieder tauchen in der Suche nicht auf, damit ihre
-- Titel nicht über den Suchindex sichtbar werden.
-- -----------------------------------------------------------------------------
create or replace function projects.searchable(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from projects.projects
                 where id = p_project and visibility = 'tenant' and not is_template and archived_at is null);
$$;

create or replace function projects.index_task(p_task uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task    record;
begin
  select t.id, t.tenant_id, t.project_id, t.number, t.title, p.name as project_name, p.number as project_number
  into v_task
  from projects.tasks t join projects.projects p on p.id = t.project_id
  where t.id = p_task;
  if not found or not projects.searchable(v_task.project_id) then
    perform core.search_remove('task', p_task);
  else
    perform core.search_upsert(v_task.tenant_id, 'task', v_task.id, v_task.title,
      concat_ws(' · ', '#' || v_task.number, v_task.project_name),
      'projekte/' || v_task.project_id || '/aufgaben/' || v_task.id, 'projects.view');
  end if;
end $$;

create or replace function projects.search_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_task uuid;
begin
  if tg_table_name = 'tasks' then
    if tg_op = 'DELETE' then
      perform core.search_remove('task', old.id);
    else
      perform projects.index_task(new.id);
    end if;
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    perform core.search_remove('project', old.id);
    return old;
  end if;
  if projects.searchable(new.id) then
    perform core.search_upsert(new.tenant_id, 'project', new.id, new.name, new.number, 'projekte/' || new.id, 'projects.view');
  else
    perform core.search_remove('project', new.id);
  end if;
  -- Sichtbarkeit oder Name geändert → Aufgaben neu indizieren
  if tg_op = 'UPDATE' and (new.visibility, new.is_template, new.archived_at is null, new.name)
                          is distinct from (old.visibility, old.is_template, old.archived_at is null, old.name) then
    for v_task in select id from projects.tasks where project_id = new.id loop
      perform projects.index_task(v_task);
    end loop;
  end if;
  return new;
end $$;
create trigger projects_search after insert or update or delete on projects.projects
  for each row execute function projects.search_sync();
create trigger tasks_search after insert or update of title, project_id or delete on projects.tasks
  for each row execute function projects.search_sync();

-- -----------------------------------------------------------------------------
-- Benachrichtigungen
-- -----------------------------------------------------------------------------
create or replace function projects.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if new.assignee_member_id is null
     or (tg_op = 'UPDATE' and new.assignee_member_id is not distinct from old.assignee_member_id) then
    return new;
  end if;
  select user_id into v_user from core.tenant_members where id = new.assignee_member_id;
  if v_user is null or v_user = (select auth.uid()) then
    return new;
  end if;
  perform core.notify(new.tenant_id, v_user, 'projects.task.assigned',
    'Dir wurde die Aufgabe „' || new.title || '“ zugewiesen',
    (select name from projects.projects where id = new.project_id),
    'projekte/' || new.project_id || '/aufgaben/' || new.id);
  return new;
end $$;
create trigger tasks_notify after insert or update of assignee_member_id on projects.tasks
  for each row execute function projects.notify_task_assigned();

-- Neuer Kommentar → zuständige Person und Ersteller der Aufgabe (nicht man selbst)
create or replace function projects.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_task record;
  v_user uuid;
begin
  select t.id, t.title, t.created_by, m.user_id as assignee_user
  into v_task
  from projects.tasks t left join core.tenant_members m on m.id = t.assignee_member_id
  where t.id = new.task_id;
  for v_user in
    select distinct u from unnest(array[v_task.assignee_user, v_task.created_by]) as u
    where u is not null and u is distinct from new.author_id
  loop
    perform core.notify(new.tenant_id, v_user, 'projects.task.commented',
      'Neuer Kommentar zu „' || v_task.title || '“', left(new.body, 200),
      'projekte/' || new.project_id || '/aufgaben/' || new.task_id);
  end loop;
  return new;
end $$;
create trigger comments_notify after insert on projects.comments
  for each row execute function projects.notify_comment();

-- Hinzugefügt zu einem Projekt
create or replace function projects.notify_member_added()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  select user_id into v_user from core.tenant_members where id = new.member_id;
  if v_user is null or v_user = (select auth.uid()) then
    return new;
  end if;
  perform core.notify(new.tenant_id, v_user, 'projects.member.added',
    'Du wurdest dem Projekt „' || (select name from projects.projects where id = new.project_id) || '“ hinzugefügt',
    null, 'projekte/' || new.project_id);
  return new;
end $$;
create trigger project_members_notify after insert on projects.project_members
  for each row execute function projects.notify_member_added();

-- Fällige Aufgaben (Fälligkeitstag in der Zeitzone des Unternehmens), alle 15 Minuten
create or replace function projects.send_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_row   record;
begin
  for v_row in
    update projects.tasks t set reminder_notified_at = now()
    from core.tenants te, projects.projects p
    where te.id = t.tenant_id and p.id = t.project_id
      and t.due_date is not null and t.completed_at is null and t.reminder_notified_at is null
      and p.archived_at is null and not p.is_template
      and t.due_date <= (now() at time zone te.timezone)::date
    returning t.tenant_id, t.id, t.project_id, t.title, t.assignee_member_id, t.created_by
  loop
    perform core.notify(v_row.tenant_id,
      coalesce((select user_id from core.tenant_members where id = v_row.assignee_member_id), v_row.created_by),
      'projects.task.due', 'Aufgabe fällig: „' || v_row.title || '“', null,
      'projekte/' || v_row.project_id || '/aufgaben/' || v_row.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
select cron.schedule('nova-projects-reminders', '*/15 * * * *', 'select projects.send_reminders()');

-- -----------------------------------------------------------------------------
-- Fachfunktionen (SECURITY INVOKER: RLS gilt)
-- -----------------------------------------------------------------------------

-- Aufgabe auf dem Board verschieben: Status und Position in einem Schritt
create or replace function projects.move_task(p_task uuid, p_status uuid, p_before uuid default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_task     projects.tasks;
  v_position double precision;
  v_prev     double precision;
begin
  select * into v_task from projects.tasks where id = p_task;
  if not found then
    raise exception 'Aufgabe nicht gefunden' using errcode = 'P0002';
  end if;
  if p_before is not null then
    select position into v_position from projects.tasks
    where id = p_before and project_id = v_task.project_id and status_id = p_status;
    select max(position) into v_prev from projects.tasks
    where project_id = v_task.project_id and status_id = p_status and position < v_position and id <> p_task;
    v_position := case when v_position is null then null
                       when v_prev is null then v_position - 1
                       else (v_prev + v_position) / 2 end;
  end if;
  if v_position is null then
    select coalesce(max(position), 0) + 1 into v_position from projects.tasks
    where project_id = v_task.project_id and status_id = p_status and id <> p_task;
  end if;
  update projects.tasks set status_id = p_status, position = v_position where id = p_task;
  if not found then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
end $$;

-- Fortschritt je Projekt (Hauptaufgaben; RLS gilt – nur sichtbare Projekte)
create or replace function projects.project_progress(p_tenant uuid)
returns table (project_id uuid, total integer, done integer, overdue integer)
language sql stable security invoker set search_path = '' as $$
  select t.project_id,
         count(*)::integer,
         count(*) filter (where t.completed_at is not null)::integer,
         count(*) filter (where t.completed_at is null and t.due_date < (now() at time zone te.timezone)::date)::integer
  from projects.tasks t join core.tenants te on te.id = t.tenant_id
  where t.tenant_id = p_tenant and t.parent_id is null
  group by t.project_id;
$$;

-- Stoppuhr starten (beendet eine laufende eigene Stoppuhr)
create or replace function projects.start_timer(p_project uuid, p_task uuid default null, p_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
  v_id     uuid;
begin
  select tenant_id into v_tenant from projects.projects where id = p_project;
  if not found then
    raise exception 'Projekt nicht gefunden' using errcode = 'P0002';
  end if;
  update projects.time_entries set ended_at = greatest(now(), started_at + interval '1 minute')
  where member_id = projects.my_member_id(v_tenant) and ended_at is null;
  insert into projects.time_entries (tenant_id, project_id, task_id, started_at, note)
  values (v_tenant, p_project, p_task, now(), nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end $$;

create or replace function projects.stop_timer(p_tenant uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  update projects.time_entries
  set ended_at = least(greatest(now(), started_at + interval '1 minute'), started_at + interval '24 hours')
  where tenant_id = p_tenant and member_id = projects.my_member_id(p_tenant) and ended_at is null
  returning id into v_id;
  return v_id;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table projects.counters enable row level security;
alter table projects.projects enable row level security;
alter table projects.project_members enable row level security;
alter table projects.statuses enable row level security;
alter table projects.milestones enable row level security;
alter table projects.tasks enable row level security;
alter table projects.checklist_items enable row level security;
alter table projects.task_dependencies enable row level security;
alter table projects.comments enable row level security;
alter table projects.time_entries enable row level security;

-- counters: kein Zugriff für Clients (nur über projects.next_value)

create policy projects_select on projects.projects for select to authenticated
  using (core.can(tenant_id, 'projects.view')
         and (visibility = 'tenant' or core.can(tenant_id, 'projects.manage') or projects.project_role(id) is not null));
create policy projects_insert on projects.projects for insert to authenticated
  with check (core.can(tenant_id, 'projects.edit') and created_by = (select auth.uid())
              and (not is_template or core.can(tenant_id, 'projects.manage')));
create policy projects_update on projects.projects for update to authenticated
  using (projects.can_manage(id)) with check (projects.can_manage(id));
create policy projects_delete on projects.projects for delete to authenticated
  using (core.can(tenant_id, 'projects.manage'));

create policy project_members_select on projects.project_members for select to authenticated
  using (projects.can_view(project_id));
create policy project_members_insert on projects.project_members for insert to authenticated
  with check (projects.can_manage(project_id));
create policy project_members_update on projects.project_members for update to authenticated
  using (projects.can_manage(project_id)) with check (projects.can_manage(project_id));
create policy project_members_delete on projects.project_members for delete to authenticated
  using (projects.can_manage(project_id));

do $$
declare
  t text;
begin
  -- Status und Meilensteine: lesen wer das Projekt sieht, ändern wer es einrichtet
  foreach t in array array['statuses', 'milestones'] loop
    execute format('create policy %1$s_select on projects.%1$s for select to authenticated using (projects.can_view(project_id))', t);
    execute format('create policy %1$s_insert on projects.%1$s for insert to authenticated with check (projects.can_manage(project_id))', t);
    execute format('create policy %1$s_update on projects.%1$s for update to authenticated using (projects.can_manage(project_id)) with check (projects.can_manage(project_id))', t);
    execute format('create policy %1$s_delete on projects.%1$s for delete to authenticated using (projects.can_manage(project_id))', t);
  end loop;
  -- Checklisten und Abhängigkeiten: ändern wer Aufgaben bearbeitet
  foreach t in array array['checklist_items', 'task_dependencies'] loop
    execute format('create policy %1$s_select on projects.%1$s for select to authenticated using (projects.can_view(project_id))', t);
    execute format('create policy %1$s_insert on projects.%1$s for insert to authenticated with check (projects.can_edit(project_id))', t);
    execute format('create policy %1$s_update on projects.%1$s for update to authenticated using (projects.can_edit(project_id)) with check (projects.can_edit(project_id))', t);
    execute format('create policy %1$s_delete on projects.%1$s for delete to authenticated using (projects.can_edit(project_id))', t);
  end loop;
end $$;

create policy tasks_select on projects.tasks for select to authenticated using (projects.can_view(project_id));
create policy tasks_insert on projects.tasks for insert to authenticated
  with check (projects.can_edit(project_id) and created_by = (select auth.uid()));
create policy tasks_update on projects.tasks for update to authenticated
  using (projects.can_edit(project_id)) with check (projects.can_edit(project_id));
create policy tasks_delete on projects.tasks for delete to authenticated
  using (projects.can_manage(project_id) or (created_by = (select auth.uid()) and projects.can_edit(project_id)));

create policy comments_select on projects.comments for select to authenticated using (projects.can_view(project_id));
create policy comments_insert on projects.comments for insert to authenticated
  with check (projects.can_edit(project_id) and author_id = (select auth.uid()));
create policy comments_update on projects.comments for update to authenticated
  using (author_id = (select auth.uid()) and projects.can_edit(project_id))
  with check (author_id = (select auth.uid()) and projects.can_edit(project_id));
create policy comments_delete on projects.comments for delete to authenticated
  using ((author_id = (select auth.uid()) and projects.can_edit(project_id)) or projects.can_manage(project_id));

-- Zeiten: eigene mit projects.time (in sichtbaren Projekten), alle mit projects.time_all
create policy time_entries_select on projects.time_entries for select to authenticated
  using ((user_id = (select auth.uid()) and core.can(tenant_id, 'projects.time'))
         or core.can(tenant_id, 'projects.time_all'));
create policy time_entries_insert on projects.time_entries for insert to authenticated
  with check (projects.can_view(project_id)
              and ((member_id = projects.my_member_id(tenant_id) and core.can(tenant_id, 'projects.time'))
                   or core.can(tenant_id, 'projects.time_all'))
              and (select archived_at is null from projects.projects where id = project_id));
create policy time_entries_update on projects.time_entries for update to authenticated
  using ((user_id = (select auth.uid()) and core.can(tenant_id, 'projects.time')) or core.can(tenant_id, 'projects.time_all'))
  with check (projects.can_view(project_id)
              and ((user_id = (select auth.uid()) and core.can(tenant_id, 'projects.time')) or core.can(tenant_id, 'projects.time_all')));
create policy time_entries_delete on projects.time_entries for delete to authenticated
  using ((user_id = (select auth.uid()) and core.can(tenant_id, 'projects.time')) or core.can(tenant_id, 'projects.time_all'));

-- =============================================================================
-- Rechte
-- =============================================================================
grant select, insert, update, delete on projects.projects, projects.project_members, projects.statuses,
  projects.milestones, projects.tasks, projects.checklist_items, projects.task_dependencies,
  projects.comments, projects.time_entries to authenticated;
grant all on all tables in schema projects to service_role;

revoke all on function projects.next_value(uuid, uuid), projects.assign_project_number(), projects.protect_project(),
  projects.setup_project(), projects.sync_lead(), projects.protect_last_manager(), projects.protect_member_row(),
  projects.protect_status(), projects.prepare_task(), projects.check_dependency(), projects.protect_comment(),
  projects.prepare_time_entry(), projects.write_audit_log(), projects.searchable(uuid), projects.index_task(uuid),
  projects.search_sync(), projects.notify_task_assigned(), projects.notify_comment(), projects.notify_member_added(),
  projects.send_reminders() from public, anon, authenticated;
revoke all on function projects.my_member_id(uuid), projects.project_role(uuid), projects.can_view(uuid),
  projects.can_edit(uuid), projects.can_manage(uuid), projects.move_task(uuid, uuid, uuid), projects.project_progress(uuid),
  projects.start_timer(uuid, uuid, text), projects.stop_timer(uuid) from public, anon;
grant execute on function projects.my_member_id(uuid), projects.project_role(uuid), projects.can_view(uuid),
  projects.can_edit(uuid), projects.can_manage(uuid), projects.move_task(uuid, uuid, uuid), projects.project_progress(uuid),
  projects.start_timer(uuid, uuid, text), projects.stop_timer(uuid) to authenticated;
grant execute on function projects.send_reminders() to service_role;

-- =============================================================================
-- Bestehende Unternehmen erhalten das Modul (vor der Abrechnung: Standard)
-- =============================================================================
insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select id, 'projects', true, 'included' from core.tenants
on conflict (tenant_id, module_key) do nothing;
