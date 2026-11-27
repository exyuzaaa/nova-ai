-- =============================================================================
-- NOVA CORE – Benachrichtigungen und globale Suche (Plattform-Phase 1d)
-- -----------------------------------------------------------------------------
-- Benachrichtigungen
--   * core.notifications: In-App-Benachrichtigungen je Empfänger und Unternehmen.
--     Erzeugt ausschließlich serverseitig (core.notify, Trigger auf echte Ereignisse);
--     Empfänger dürfen nur lesen, als gelesen markieren und löschen.
--   * core.notification_preferences: je Nutzer und Art (in_app / email). E-Mail-Versand
--     folgt mit dem E-Mail-Anbieter; die Einstellung wird bereits gespeichert.
--
-- Suche
--   * core.search_index: ein Eintrag je durchsuchbarem Datensatz (Titel, Untertitel,
--     Ziel, nötiges Recht). Trigger der Module halten ihn aktuell.
--   * Lesen nur per RLS mit core.can(tenant, recht) – Treffer berücksichtigen immer die
--     Rechte des Suchenden. core.search() läuft als Aufrufer (SECURITY INVOKER).
-- =============================================================================

-- =============================================================================
-- Benachrichtigungen
-- =============================================================================
create table core.notifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references core.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind ~ '^[a-z_]+(\.[a-z_]+){1,3}$'),
  title      text not null check (char_length(title) between 1 and 200),
  body       text check (char_length(body) <= 1000),
  -- Ziel innerhalb der App: relativ zum Unternehmen ("verwaltung/…") oder absolut ("/analytics/…")
  href       text check (href is null or (char_length(href) <= 300 and href !~ '^//' and href !~ ':')),
  metadata   jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_tenant_idx on core.notifications (user_id, tenant_id, created_at desc);
create index notifications_unread_idx on core.notifications (user_id, tenant_id) where read_at is null;
create index notifications_tenant_idx on core.notifications (tenant_id);

create table core.notification_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind ~ '^[a-z_]+(\.[a-z_]+){1,3}$'),
  in_app     boolean not null default true,
  email      boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create trigger notification_preferences_updated_at before update on core.notification_preferences
  for each row execute function core.set_updated_at();

-- Eine Benachrichtigung an eine Person – nur wenn sie Mitglied ist und die Art nicht abbestellt hat.
create or replace function core.notify(
  p_tenant   uuid,
  p_user     uuid,
  p_kind     text,
  p_title    text,
  p_body     text default null,
  p_href     text default null,
  p_metadata jsonb default '{}'
)
returns void language sql security definer set search_path = '' as $$
  insert into core.notifications (tenant_id, user_id, kind, title, body, href, metadata)
  select p_tenant, p_user, p_kind, left(p_title, 200), left(p_body, 1000), p_href, coalesce(p_metadata, '{}')
  where exists (select 1 from core.tenant_members m where m.tenant_id = p_tenant and m.user_id = p_user)
    and not exists (
      select 1 from core.notification_preferences np
      where np.user_id = p_user and np.kind = p_kind and not np.in_app
    );
$$;

-- An alle Mitglieder ab einer Rolle (optional ohne die auslösende Person).
create or replace function core.notify_role(
  p_tenant   uuid,
  p_min      core.member_role,
  p_kind     text,
  p_title    text,
  p_body     text default null,
  p_href     text default null,
  p_exclude  uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  for v_user in
    select m.user_id from core.tenant_members m
    where m.tenant_id = p_tenant and m.role >= p_min and m.user_id is distinct from p_exclude
  loop
    perform core.notify(p_tenant, v_user, p_kind, p_title, p_body, p_href);
  end loop;
end $$;

-- Ereignisse des Kerns, die Personen betreffen ---------------------------------------
create or replace function core.notify_member_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_label text;
begin
  if tg_op = 'INSERT' then
    select email into v_email from auth.users where id = new.user_id;
    perform core.notify_role(new.tenant_id, 'admin', 'core.member.joined',
      coalesce(v_email, 'Eine Person') || ' ist dem Unternehmen beigetreten', null, 'verwaltung/mitglieder', new.user_id);
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    v_label := case new.role when 'owner' then 'Owner' when 'admin' then 'Administrator'
                             when 'member' then 'Mitglied' else 'Betrachter' end;
    if new.user_id is distinct from (select auth.uid()) then
      perform core.notify(new.tenant_id, new.user_id, 'core.member.role_changed',
        'Deine Rolle wurde geändert: ' || v_label, null, 'verwaltung/mitglieder');
    end if;
  end if;
  return new;
end $$;
create trigger tenant_members_notify after insert or update of role on core.tenant_members
  for each row execute function core.notify_member_events();

create or replace function core.notify_role_assigned()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_role text;
begin
  select m.user_id into v_user from core.tenant_members m where m.id = new.member_id;
  select r.name into v_role from core.roles r where r.id = new.role_id;
  if v_user is distinct from (select auth.uid()) then
    perform core.notify(new.tenant_id, v_user, 'core.role.assigned',
      'Dir wurde die Rolle „' || coalesce(v_role, '') || '“ zugewiesen', null, 'verwaltung/rollen');
  end if;
  return new;
end $$;
create trigger member_roles_notify after insert on core.member_roles
  for each row execute function core.notify_role_assigned();

create or replace function core.notify_team_joined()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_team text;
begin
  select m.user_id into v_user from core.tenant_members m where m.id = new.member_id;
  select t.name into v_team from core.teams t where t.id = new.team_id;
  if v_user is distinct from (select auth.uid()) then
    perform core.notify(new.tenant_id, v_user, 'core.team.joined',
      'Du wurdest dem Team „' || coalesce(v_team, '') || '“ hinzugefügt', null, 'verwaltung/abteilungen');
  end if;
  return new;
end $$;
create trigger team_members_notify after insert on core.team_members
  for each row execute function core.notify_team_joined();

create or replace function core.notify_module_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.enabled is distinct from old.enabled then
    select name into v_name from core.modules where key = new.module_key;
    perform core.notify_role(new.tenant_id, 'admin', 'core.module.changed',
      'Modul ' || coalesce(v_name, new.module_key) || case when new.enabled then ' eingeschaltet' else ' ausgeschaltet' end,
      null, 'verwaltung/module', (select auth.uid()));
  end if;
  return new;
end $$;
create trigger tenant_modules_notify after update of enabled on core.tenant_modules
  for each row execute function core.notify_module_changed();

-- Gelesene Benachrichtigungen nach 90 Tagen, ungelesene nach 365 Tagen entfernen
create or replace function core.purge_notifications()
returns void language sql security definer set search_path = '' as $$
  delete from core.notifications
  where (read_at is not null and read_at < now() - interval '90 days')
     or created_at < now() - interval '365 days';
$$;
select cron.schedule('nova-core-notifications-retention', '45 3 * * *', 'select core.purge_notifications()');

alter table core.notifications enable row level security;
alter table core.notification_preferences enable row level security;

-- Nur eigene Benachrichtigungen, nur solange man Mitglied ist
create policy notifications_select on core.notifications for select to authenticated
  using (user_id = (select auth.uid()) and core.has_tenant_role(tenant_id, 'viewer'));
create policy notifications_update on core.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on core.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy notification_preferences_select on core.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert on core.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy notification_preferences_update on core.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_delete on core.notification_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- Globale Suche
-- =============================================================================
create table core.search_index (
  tenant_id   uuid not null references core.tenants(id) on delete cascade,
  entity_type text not null check (entity_type ~ '^[a-z_]{2,40}$'),
  entity_id   uuid not null,
  title       text not null check (char_length(title) between 1 and 300),
  subtitle    text check (char_length(subtitle) <= 300),
  href        text not null check (char_length(href) <= 300 and href !~ '^//' and href !~ ':'),
  permission  text not null references core.permissions(key) on delete cascade,
  -- Satzzeichen trennen Wörter: "shop-vertrieb.example" ist auch unter "vertrieb" auffindbar
  search      tsvector generated always as (
                to_tsvector('simple', regexp_replace(coalesce(title, '') || ' ' || coalesce(subtitle, ''), '[^[:alnum:]]+', ' ', 'g'))
              ) stored,
  updated_at  timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
create index search_index_tenant_idx on core.search_index (tenant_id);
create index search_index_search_idx on core.search_index using gin (search);
create index search_index_permission_idx on core.search_index (permission);

create or replace function core.search_upsert(
  p_tenant uuid, p_type text, p_id uuid, p_title text, p_subtitle text, p_href text, p_permission text
)
returns void language sql security definer set search_path = '' as $$
  insert into core.search_index (tenant_id, entity_type, entity_id, title, subtitle, href, permission)
  values (p_tenant, p_type, p_id, left(coalesce(nullif(btrim(p_title), ''), '–'), 300), left(p_subtitle, 300), p_href, p_permission)
  on conflict (entity_type, entity_id) do update
    set tenant_id = excluded.tenant_id, title = excluded.title, subtitle = excluded.subtitle,
        href = excluded.href, permission = excluded.permission, updated_at = now();
$$;

create or replace function core.search_remove(p_type text, p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from core.search_index where entity_type = p_type and entity_id = p_id;
$$;

-- Indexierung der Kern-Datensätze
create or replace function core.search_sync_core()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  if tg_op = 'DELETE' then
    perform core.search_remove(
      case tg_table_name when 'departments' then 'department' when 'teams' then 'team'
                         when 'roles' then 'role' else 'member' end, old.id);
    return old;
  end if;
  if tg_table_name = 'departments' then
    perform core.search_upsert(new.tenant_id, 'department', new.id, new.name, new.description, 'verwaltung/abteilungen', 'core.departments.read');
  elsif tg_table_name = 'teams' then
    perform core.search_upsert(new.tenant_id, 'team', new.id, new.name, new.description, 'verwaltung/abteilungen', 'core.departments.read');
  elsif tg_table_name = 'roles' then
    perform core.search_upsert(new.tenant_id, 'role', new.id, new.name, new.description, 'verwaltung/rollen', 'core.members.read');
  elsif tg_table_name = 'tenant_members' then
    select email into v_email from auth.users where id = new.user_id;
    perform core.search_upsert(new.tenant_id, 'member', new.id, coalesce(v_email, 'Mitglied'),
      case new.role when 'owner' then 'Owner' when 'admin' then 'Administrator' when 'member' then 'Mitglied' else 'Betrachter' end,
      'verwaltung/mitglieder', 'core.members.read');
  end if;
  return new;
end $$;
create trigger departments_search after insert or update or delete on core.departments
  for each row execute function core.search_sync_core();
create trigger teams_search after insert or update or delete on core.teams
  for each row execute function core.search_sync_core();
create trigger roles_search after insert or update or delete on core.roles
  for each row execute function core.search_sync_core();
create trigger tenant_members_search after insert or update or delete on core.tenant_members
  for each row execute function core.search_sync_core();

-- Analytics: Websites
create or replace function analytics.search_sync_website()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.deleted_at is not null then
    perform core.search_remove('website', coalesce(new.id, old.id));
  else
    perform core.search_upsert(new.organization_id, 'website', new.id, new.name, new.domain,
      '/analytics/' || new.id, 'analytics.view');
  end if;
  return coalesce(new, old);
end $$;
create trigger websites_search after insert or update or delete on analytics.websites
  for each row execute function analytics.search_sync_website();

-- Bestand indexieren
select core.search_upsert(tenant_id, 'department', id, name, description, 'verwaltung/abteilungen', 'core.departments.read') from core.departments;
select core.search_upsert(tenant_id, 'team', id, name, description, 'verwaltung/abteilungen', 'core.departments.read') from core.teams;
select core.search_upsert(tenant_id, 'role', id, name, description, 'verwaltung/rollen', 'core.members.read') from core.roles;
select core.search_upsert(m.tenant_id, 'member', m.id, coalesce(u.email, 'Mitglied'),
  case m.role when 'owner' then 'Owner' when 'admin' then 'Administrator' when 'member' then 'Mitglied' else 'Betrachter' end,
  'verwaltung/mitglieder', 'core.members.read')
from core.tenant_members m left join auth.users u on u.id = m.user_id;
select core.search_upsert(organization_id, 'website', id, name, domain, '/analytics/' || id, 'analytics.view')
from analytics.websites where deleted_at is null;

alter table core.search_index enable row level security;
-- Jeder Treffer verlangt das Recht des Eintrags (inkl. Modulfreischaltung und Sperre)
create policy search_index_select on core.search_index for select to authenticated
  using (core.can(tenant_id, permission));

-- Suchbegriff in eine Präfix-Suche umwandeln: "ver nor" → 'ver':* & 'nor':*
create or replace function core.search_query(p_query text)
returns tsquery language sql immutable set search_path = '' as $$
  select case when count(*) = 0 then null
              else to_tsquery('simple', string_agg(quote_literal(word) || ':*', ' & ')) end
  from (
    select lower(word) as word
    from regexp_split_to_table(left(coalesce(p_query, ''), 200), '[^[:alnum:]]+') as word
    where word <> ''
    limit 8
  ) words;
$$;

-- Suche im Unternehmen. SECURITY INVOKER: die RLS-Policy filtert nach Rechten.
create or replace function core.search(p_tenant uuid, p_query text, p_limit integer default 30)
returns table (entity_type text, entity_id uuid, title text, subtitle text, href text, rank real)
language sql stable security invoker set search_path = '' as $$
  select s.entity_type, s.entity_id, s.title, s.subtitle, s.href, ts_rank(s.search, q) as rank
  from core.search_index s, core.search_query(p_query) q
  where q is not null
    and s.tenant_id = p_tenant
    and s.search @@ q
  order by rank desc, s.title
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- =============================================================================
-- Rechte
-- =============================================================================
revoke all on core.notifications, core.notification_preferences, core.search_index from public, anon, authenticated;
grant select, delete on core.notifications to authenticated;
grant update (read_at) on core.notifications to authenticated;
grant select, insert, update, delete on core.notification_preferences to authenticated;
grant select on core.search_index to authenticated;
grant all on core.notifications, core.notification_preferences, core.search_index to service_role;

revoke all on function core.notify(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function core.notify_role(uuid, core.member_role, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function core.notify_member_events() from public, anon, authenticated;
revoke all on function core.notify_role_assigned() from public, anon, authenticated;
revoke all on function core.notify_team_joined() from public, anon, authenticated;
revoke all on function core.notify_module_changed() from public, anon, authenticated;
revoke all on function core.purge_notifications() from public, anon, authenticated;
revoke all on function core.search_upsert(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function core.search_remove(text, uuid) from public, anon, authenticated;
revoke all on function core.search_sync_core() from public, anon, authenticated;
revoke all on function analytics.search_sync_website() from public, anon, authenticated;
revoke all on function core.search_query(text) from public, anon;
revoke all on function core.search(uuid, text, integer) from public, anon;

grant execute on function core.notify(uuid, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function core.notify_role(uuid, core.member_role, text, text, text, text, uuid) to service_role;
grant execute on function core.search_query(text) to authenticated, service_role;
grant execute on function core.search(uuid, text, integer) to authenticated, service_role;
