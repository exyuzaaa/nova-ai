-- =============================================================================
-- NOVA Kalender – persönliche, Team- und Unternehmenskalender, Termine mit
-- Wiederholung, Teilnehmer, Erinnerungen, Frei/Belegt, iCal-Abo (Phase 2c)
-- -----------------------------------------------------------------------------
-- Grundsätze
--   * Jede Person hat einen persönlichen Kalender (nur sie sieht die Inhalte;
--     andere sehen über calendar.busy() nur „belegt“). Jedes Team hat einen
--     Teamkalender (Teammitglieder), jedes Unternehmen einen Unternehmenskalender
--     (alle mit calendar.view, ändern mit calendar.manage).
--   * Eingeladene sehen den Termin, auch wenn sie den Kalender nicht sehen.
--   * Wiederholungen werden in der Zeitzone des Unternehmens berechnet
--     (Sommer-/Winterzeit bleibt bei gleicher Uhrzeit).
--   * Persönliche Termine stehen weder in der Suche noch mit Titel im Protokoll.
-- =============================================================================

update core.modules set status = 'available', enabled_by_default = true where key = 'calendar';

insert into core.permissions (key, module_key, name, description, default_role, grantable, is_sensitive, sort_order) values
  ('calendar.view',   'calendar', 'Kalender ansehen',   'Eigene, Team- und Unternehmenstermine sowie Frei/Belegt anderer Personen.', 'viewer', true, false, 10),
  ('calendar.edit',   'calendar', 'Termine bearbeiten', 'Termine im eigenen und in Teamkalendern anlegen und ändern, Personen einladen.', 'member', true, false, 20),
  ('calendar.manage', 'calendar', 'Kalender verwalten', 'Unternehmenskalender pflegen und alle Teamkalender bearbeiten.', 'admin', true, false, 30);

-- -----------------------------------------------------------------------------
-- Tabellen
-- -----------------------------------------------------------------------------
create table calendar.calendars (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references core.tenants(id) on delete cascade,
  kind            text not null check (kind in ('personal', 'team', 'company')),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  color           text not null default '#0ea5e9' check (color ~ '^#[0-9a-f]{6}$'),
  owner_member_id uuid,
  team_id         uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, id),
  check ((kind = 'personal') = (owner_member_id is not null)),
  check ((kind = 'team') = (team_id is not null)),
  foreign key (tenant_id, owner_member_id) references core.tenant_members(tenant_id, id) on delete cascade,
  foreign key (tenant_id, team_id) references core.teams(tenant_id, id) on delete cascade
);
create unique index calendars_personal_idx on calendar.calendars (owner_member_id) where kind = 'personal';
create unique index calendars_team_idx on calendar.calendars (team_id) where kind = 'team';
create unique index calendars_company_idx on calendar.calendars (tenant_id) where kind = 'company';

create table calendar.events (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  calendar_id      uuid not null,
  title            text not null check (char_length(btrim(title)) between 1 and 200),
  description      text check (char_length(description) <= 5000),
  location         text check (char_length(location) <= 300),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  all_day          boolean not null default false,
  repeat_freq      text check (repeat_freq in ('daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval  smallint not null default 1 check (repeat_interval between 1 and 99),
  repeat_weekdays  smallint[] not null default '{}' check (repeat_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  repeat_until     date,
  repeat_count     smallint check (repeat_count between 1 and 500),
  exception_dates  date[] not null default '{}' check (cardinality(exception_dates) <= 500),
  reminder_minutes integer check (reminder_minutes between 0 and 40320),
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_at > starts_at and ends_at - starts_at <= interval '31 days'),
  check (repeat_freq is not null or (repeat_until is null and repeat_count is null and cardinality(repeat_weekdays) = 0)),
  foreign key (tenant_id, calendar_id) references calendar.calendars(tenant_id, id) on delete cascade
);
create index events_calendar_time_idx on calendar.events (tenant_id, calendar_id, starts_at);
create index events_repeat_idx on calendar.events (tenant_id, calendar_id) where repeat_freq is not null;
create index events_reminder_idx on calendar.events (starts_at) where reminder_minutes is not null;
create index events_created_by_idx on calendar.events (created_by);

create table calendar.attendees (
  tenant_id    uuid not null,
  event_id     uuid not null,
  member_id    uuid not null,
  response     text not null default 'pending' check (response in ('pending', 'accepted', 'tentative', 'declined')),
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (event_id, member_id),
  foreign key (tenant_id, event_id) references calendar.events(tenant_id, id) on delete cascade,
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete cascade
);
create index attendees_member_idx on calendar.attendees (tenant_id, member_id);
create index attendees_event_idx on calendar.attendees (tenant_id, event_id);

create table calendar.reminders_sent (
  event_id         uuid not null references calendar.events(id) on delete cascade,
  occurrence_start timestamptz not null,
  sent_at          timestamptz not null default now(),
  primary key (event_id, occurrence_start)
);

create table calendar.feed_tokens (
  member_id  uuid primary key,
  tenant_id  uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  foreign key (tenant_id, member_id) references core.tenant_members(tenant_id, id) on delete cascade
);
create index feed_tokens_tenant_idx on calendar.feed_tokens (tenant_id);

-- -----------------------------------------------------------------------------
-- Zugriff (SECURITY DEFINER, geprüft für den angemeldeten Nutzer)
-- -----------------------------------------------------------------------------
create or replace function calendar.my_member_id(p_tenant uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from core.tenant_members m where m.tenant_id = p_tenant and m.user_id = (select auth.uid());
$$;

create or replace function calendar.can_view_calendar(p_calendar uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from calendar.calendars c
    where c.id = p_calendar
      and core.can(c.tenant_id, 'calendar.view')
      and (c.kind = 'company'
           or (c.kind = 'personal' and c.owner_member_id = calendar.my_member_id(c.tenant_id))
           or (c.kind = 'team' and (core.can(c.tenant_id, 'calendar.manage')
                                    or exists (select 1 from core.team_members tm
                                               where tm.team_id = c.team_id and tm.member_id = calendar.my_member_id(c.tenant_id)))))
  );
$$;

create or replace function calendar.can_edit_calendar(p_calendar uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from calendar.calendars c
    where c.id = p_calendar
      and (core.can(c.tenant_id, 'calendar.manage') and c.kind in ('company', 'team')
           or (core.can(c.tenant_id, 'calendar.edit')
               and ((c.kind = 'personal' and c.owner_member_id = calendar.my_member_id(c.tenant_id))
                    or (c.kind = 'team' and exists (select 1 from core.team_members tm
                                                    where tm.team_id = c.team_id and tm.member_id = calendar.my_member_id(c.tenant_id)))))
           or (c.kind = 'personal' and c.owner_member_id = calendar.my_member_id(c.tenant_id) and core.can(c.tenant_id, 'calendar.edit')))
  );
$$;

create or replace function calendar.is_attendee(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from calendar.attendees a join core.tenant_members m on m.id = a.member_id
    where a.event_id = p_event and m.user_id = (select auth.uid()) and core.can(a.tenant_id, 'calendar.view')
  );
$$;

create or replace function calendar.can_view_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from calendar.events e where e.id = p_event and calendar.can_view_calendar(e.calendar_id))
      or calendar.is_attendee(p_event);
$$;

create or replace function calendar.can_edit_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from calendar.events e where e.id = p_event and calendar.can_edit_calendar(e.calendar_id));
$$;

-- -----------------------------------------------------------------------------
-- Kalender automatisch anlegen
-- -----------------------------------------------------------------------------
create or replace function calendar.ensure_company_calendar(p_tenant uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from calendar.calendars where tenant_id = p_tenant and kind = 'company';
  if not found then
    insert into calendar.calendars (tenant_id, kind, name, color) values (p_tenant, 'company', 'Unternehmen', '#6366f1')
    returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function calendar.on_member_added()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into calendar.calendars (tenant_id, kind, name, owner_member_id, color)
  values (new.tenant_id, 'personal', 'Mein Kalender', new.id, '#0ea5e9')
  on conflict do nothing;
  return new;
end $$;
create trigger tenant_members_calendar after insert on core.tenant_members
  for each row execute function calendar.on_member_added();

create or replace function calendar.on_team_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into calendar.calendars (tenant_id, kind, name, team_id, color)
    values (new.tenant_id, 'team', new.name, new.id, '#10b981')
    on conflict do nothing;
  elsif new.name is distinct from old.name then
    update calendar.calendars set name = new.name where team_id = new.id and kind = 'team';
  end if;
  return new;
end $$;
create trigger teams_calendar after insert or update of name on core.teams
  for each row execute function calendar.on_team_changed();

create or replace function calendar.on_module_enabled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.module_key = 'calendar' and new.enabled then
    perform calendar.ensure_company_calendar(new.tenant_id);
  end if;
  return new;
end $$;
create trigger tenant_modules_calendar_setup after insert or update of enabled on core.tenant_modules
  for each row execute function calendar.on_module_enabled();

-- -----------------------------------------------------------------------------
-- Schutz und Standardwerte
-- -----------------------------------------------------------------------------
create or replace function calendar.protect_calendar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.kind := old.kind;
  new.owner_member_id := old.owner_member_id;
  new.team_id := old.team_id;
  return new;
end $$;
create trigger calendars_protect before update on calendar.calendars
  for each row execute function calendar.protect_calendar();

create or replace function calendar.prepare_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if new.repeat_freq is null then
    new.repeat_until := null;
    new.repeat_count := null;
    new.repeat_weekdays := '{}';
    new.exception_dates := '{}';
  end if;
  new.repeat_weekdays := (select coalesce(array_agg(distinct d order by d), '{}') from unnest(new.repeat_weekdays) d);
  return new;
end $$;
create trigger events_prepare before insert or update on calendar.events
  for each row execute function calendar.prepare_event();

-- Teilnehmer: wer nicht bearbeiten darf, ändert nur die eigene Antwort
create or replace function calendar.protect_attendee()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.tenant_id := old.tenant_id;
  new.event_id := old.event_id;
  new.member_id := old.member_id;
  if new.response is distinct from old.response then
    new.responded_at := now();
  end if;
  return new;
end $$;
create trigger attendees_protect before update on calendar.attendees
  for each row execute function calendar.protect_attendee();

create trigger calendars_updated_at before update on calendar.calendars for each row execute function core.set_updated_at();
create trigger events_updated_at before update on calendar.events for each row execute function core.set_updated_at();

-- -----------------------------------------------------------------------------
-- Wiederholungen: Vorkommen eines Termins im Zeitraum [p_from, p_to)
-- -----------------------------------------------------------------------------
create or replace function calendar.occurrences(p_event calendar.events, p_from timestamptz, p_to timestamptz, p_tz text)
returns table (occurrence_start timestamptz, occurrence_end timestamptz)
language plpgsql stable set search_path = '' as $$
declare
  v_duration interval := p_event.ends_at - p_event.starts_at;
  v_local    timestamp := p_event.starts_at at time zone p_tz;
  v_cursor   timestamp;
  v_start    timestamptz;
  v_count    integer := 0;
  v_steps    integer := 0;
  v_day      date;
  v_week0    date := (v_local::date - (extract(isodow from v_local)::integer - 1));
  v_limit    timestamp := p_to at time zone p_tz;
begin
  if p_event.repeat_freq is null then
    if p_event.starts_at < p_to and p_event.ends_at > p_from then
      occurrence_start := p_event.starts_at;
      occurrence_end := p_event.ends_at;
      return next;
    end if;
    return;
  end if;

  v_cursor := v_local;
  while v_steps < 20000 loop
    v_steps := v_steps + 1;
    exit when v_cursor >= v_limit;
    exit when p_event.repeat_until is not null and v_cursor::date > p_event.repeat_until;
    v_day := v_cursor::date;

    if p_event.repeat_freq <> 'weekly' or cardinality(p_event.repeat_weekdays) = 0
       or (extract(isodow from v_day)::smallint = any (p_event.repeat_weekdays)
           and ((v_day - v_week0) / 7) % p_event.repeat_interval = 0) then
      -- Monatlich/jährlich: nur wenn der Tag existiert (31. → Monate ohne 31. auslassen)
      if (p_event.repeat_freq not in ('monthly', 'yearly') or extract(day from v_cursor) = extract(day from v_local)) then
        v_count := v_count + 1;
        exit when p_event.repeat_count is not null and v_count > p_event.repeat_count;
        if not (v_day = any (p_event.exception_dates)) then
          v_start := v_cursor at time zone p_tz;
          if v_start < p_to and v_start + v_duration > p_from then
            occurrence_start := v_start;
            occurrence_end := v_start + v_duration;
            return next;
          end if;
        end if;
      end if;
    end if;

    v_cursor := case p_event.repeat_freq
      when 'daily' then v_cursor + make_interval(days => p_event.repeat_interval)
      when 'weekly' then case when cardinality(p_event.repeat_weekdays) = 0
                              then v_cursor + make_interval(weeks => p_event.repeat_interval)
                              else v_cursor + interval '1 day' end
      when 'monthly' then v_local + make_interval(months => p_event.repeat_interval * v_steps)
      else v_local + make_interval(years => p_event.repeat_interval * v_steps) end;
  end loop;
end $$;

-- Termine im Zeitraum: eigene Kalender, sichtbare Team-/Unternehmenskalender, Einladungen.
-- SECURITY DEFINER mit ausdrücklicher Prüfung (calendar.can_view_event), weil Eingeladene
-- den Kalender des Termins selbst nicht sehen.
create or replace function calendar.agenda(p_tenant uuid, p_from timestamptz, p_to timestamptz)
returns table (
  event_id uuid, calendar_id uuid, calendar_kind text, calendar_name text, color text, title text, location text,
  all_day boolean, occurrence_start timestamptz, occurrence_end timestamptz, is_recurring boolean,
  my_response text, can_edit boolean
)
language sql stable security definer set search_path = '' as $$
  select e.id, e.calendar_id,
         case when calendar.can_view_calendar(c.id) then c.kind else 'invited' end,
         case when calendar.can_view_calendar(c.id) then c.name else 'Einladung' end,
         case when calendar.can_view_calendar(c.id) then c.color else '#f59e0b' end,
         e.title, e.location, e.all_day,
         o.occurrence_start, o.occurrence_end, e.repeat_freq is not null,
         (select a.response from calendar.attendees a where a.event_id = e.id and a.member_id = calendar.my_member_id(p_tenant)),
         calendar.can_edit_calendar(e.calendar_id)
  from calendar.events e
  join calendar.calendars c on c.id = e.calendar_id
  join core.tenants t on t.id = e.tenant_id
  cross join lateral calendar.occurrences(e, p_from, p_to, t.timezone) o
  where e.tenant_id = p_tenant
    and p_to - p_from <= interval '93 days'
    and (e.repeat_freq is not null or (e.starts_at < p_to and e.ends_at > p_from))
    and calendar.can_view_event(e.id)
  order by o.occurrence_start, e.title;
$$;

-- Frei/Belegt anderer Personen (ohne Titel): persönliche Termine und Zusagen
create or replace function calendar.busy(p_tenant uuid, p_members uuid[], p_from timestamptz, p_to timestamptz)
returns table (member_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.member_id, o.occurrence_start, o.occurrence_end
  from (
    select c.owner_member_id as member_id, e.* from calendar.events e
    join calendar.calendars c on c.id = e.calendar_id
    where c.kind = 'personal' and c.owner_member_id = any (p_members)
    union
    select a.member_id, e.* from calendar.attendees a join calendar.events e on e.id = a.event_id
    where a.member_id = any (p_members) and a.response <> 'declined'
  ) x
  join core.tenants t on t.id = x.tenant_id
  cross join lateral calendar.occurrences(
    row(x.id, x.tenant_id, x.calendar_id, x.title, x.description, x.location, x.starts_at, x.ends_at, x.all_day, x.repeat_freq,
        x.repeat_interval, x.repeat_weekdays, x.repeat_until, x.repeat_count, x.exception_dates, x.reminder_minutes,
        x.created_by, x.created_at, x.updated_at)::calendar.events,
    p_from, p_to, t.timezone) o
  where x.tenant_id = p_tenant
    and core.can(p_tenant, 'calendar.view')
    and cardinality(p_members) <= 50
    and p_to - p_from <= interval '31 days'
    and (x.repeat_freq is not null or (x.starts_at < p_to and x.ends_at > p_from))
  order by 1, 2;
$$;

-- Antwort auf eine Einladung
create or replace function calendar.respond(p_event uuid, p_response text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  if p_response not in ('accepted', 'tentative', 'declined') then
    raise exception 'Ungültige Antwort' using errcode = '22023';
  end if;
  select tenant_id into v_tenant from calendar.events where id = p_event;
  update calendar.attendees set response = p_response
  where event_id = p_event and member_id = calendar.my_member_id(v_tenant);
  if not found then
    raise exception 'Keine Einladung gefunden' using errcode = 'P0002';
  end if;
end $$;

-- Einzelnes Vorkommen einer Serie entfallen lassen
create or replace function calendar.skip_occurrence(p_event uuid, p_date date)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update calendar.events set exception_dates = array_append(exception_dates, p_date)
  where id = p_event and repeat_freq is not null and not (p_date = any (exception_dates));
  if not found and not exists (select 1 from calendar.events where id = p_event and p_date = any (exception_dates)) then
    raise exception 'Termin nicht gefunden' using errcode = 'P0002';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- iCal-Abo: geheimer Link je Person (nur der Hash wird gespeichert)
-- -----------------------------------------------------------------------------
create or replace function calendar.create_feed_token(p_tenant uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid := calendar.my_member_id(p_tenant);
  v_token  text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if v_member is null or not core.can(p_tenant, 'calendar.view') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into calendar.feed_tokens (member_id, tenant_id, token_hash)
  values (v_member, p_tenant, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (member_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  perform core.log_audit(p_tenant, 'calendar.feed.created', 'feed_tokens', v_member::text, '{}');
  return v_token;
end $$;

create or replace function calendar.revoke_feed_token(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from calendar.feed_tokens where member_id = calendar.my_member_id(p_tenant);
end $$;

create or replace function calendar.has_feed_token(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from calendar.feed_tokens where member_id = calendar.my_member_id(p_tenant));
$$;

-- Termine für den Abo-Link (ohne Anmeldung, nur mit gültigem Token)
create or replace function calendar.feed_events(p_token text)
returns table (
  tenant_name text, timezone text, event_id uuid, calendar_name text, title text, description text, location text,
  starts_at timestamptz, ends_at timestamptz, all_day boolean, repeat_freq text, repeat_interval smallint,
  repeat_weekdays smallint[], repeat_until date, repeat_count smallint, exception_dates date[], updated_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
declare
  v_feed calendar.feed_tokens;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return;
  end if;
  select f.* into v_feed from calendar.feed_tokens f
  join core.tenant_members m on m.id = f.member_id
  join core.tenants t on t.id = f.tenant_id and t.status = 'active' and t.deleted_at is null
  where f.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and core.module_enabled(f.tenant_id, 'calendar');
  if not found then
    return;
  end if;
  update calendar.feed_tokens set last_used_at = now() where member_id = v_feed.member_id;
  return query
    select t.name, t.timezone, e.id, c.name, e.title, e.description, e.location, e.starts_at, e.ends_at, e.all_day,
           e.repeat_freq, e.repeat_interval, e.repeat_weekdays, e.repeat_until, e.repeat_count, e.exception_dates, e.updated_at
    from calendar.events e
    join calendar.calendars c on c.id = e.calendar_id
    join core.tenants t on t.id = e.tenant_id
    where e.tenant_id = v_feed.tenant_id
      and e.starts_at > now() - interval '1 year'
      and (c.kind = 'company'
           or (c.kind = 'personal' and c.owner_member_id = v_feed.member_id)
           or (c.kind = 'team' and exists (select 1 from core.team_members tm where tm.team_id = c.team_id and tm.member_id = v_feed.member_id))
           or exists (select 1 from calendar.attendees a where a.event_id = e.id and a.member_id = v_feed.member_id and a.response <> 'declined'))
    order by e.starts_at
    limit 5000;
end $$;

-- -----------------------------------------------------------------------------
-- Protokoll (nur Unternehmens- und Teamtermine mit Titel), Suche (nur Unternehmen)
-- -----------------------------------------------------------------------------
create or replace function calendar.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row  calendar.events := coalesce(new, old);
  v_kind text;
begin
  select kind into v_kind from calendar.calendars where id = v_row.calendar_id;
  if v_kind is null or v_kind = 'personal' or not exists (select 1 from core.tenants where id = v_row.tenant_id) then
    return v_row;
  end if;
  perform core.log_audit(v_row.tenant_id, 'calendar.events.' || lower(tg_op), 'events', v_row.id::text,
                         jsonb_build_object('name', v_row.title, 'calendar', v_kind));
  return v_row;
end $$;
create trigger events_audit after insert or update or delete on calendar.events
  for each row execute function calendar.write_audit_log();

create or replace function calendar.search_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  if tg_op = 'DELETE' then
    perform core.search_remove('event', old.id);
    return old;
  end if;
  select kind into v_kind from calendar.calendars where id = new.calendar_id;
  if v_kind = 'company' then
    perform core.search_upsert(new.tenant_id, 'event', new.id, new.title,
      concat_ws(' · ', to_char(new.starts_at at time zone (select timezone from core.tenants where id = new.tenant_id), 'DD.MM.YYYY HH24:MI'),
                new.location),
      'kalender/termine/' || new.id, 'calendar.view');
  else
    perform core.search_remove('event', new.id);
  end if;
  return new;
end $$;
create trigger events_search after insert or update or delete on calendar.events
  for each row execute function calendar.search_sync();

-- -----------------------------------------------------------------------------
-- Benachrichtigungen: Einladung, Änderung, Antwort, Erinnerung
-- -----------------------------------------------------------------------------
create or replace function calendar.notify_invited()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user  uuid;
  v_event calendar.events;
begin
  select user_id into v_user from core.tenant_members where id = new.member_id;
  if v_user is null or v_user = (select auth.uid()) then
    return new;
  end if;
  select * into v_event from calendar.events where id = new.event_id;
  perform core.notify(new.tenant_id, v_user, 'calendar.invited', 'Einladung: „' || v_event.title || '“',
    to_char(v_event.starts_at at time zone (select timezone from core.tenants where id = new.tenant_id), 'DD.MM.YYYY HH24:MI'),
    'kalender/termine/' || new.event_id);
  return new;
end $$;
create trigger attendees_notify after insert on calendar.attendees
  for each row execute function calendar.notify_invited();

create or replace function calendar.notify_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_event calendar.events;
begin
  if new.response is not distinct from old.response or new.response = 'pending' then
    return new;
  end if;
  select * into v_event from calendar.events where id = new.event_id;
  if v_event.created_by is not null and v_event.created_by is distinct from (select auth.uid()) then
    perform core.notify(new.tenant_id, v_event.created_by, 'calendar.response',
      case new.response when 'accepted' then 'Zusage' when 'tentative' then 'Vielleicht' else 'Absage' end
        || ' für „' || v_event.title || '“',
      (select u.email from core.tenant_members m join auth.users u on u.id = m.user_id where m.id = new.member_id),
      'kalender/termine/' || new.event_id);
  end if;
  return new;
end $$;
create trigger attendees_response_notify after update of response on calendar.attendees
  for each row execute function calendar.notify_response();

-- Zeit oder Ort geändert → Eingeladene informieren
create or replace function calendar.notify_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if (new.starts_at, new.ends_at, new.location, new.repeat_freq) is not distinct from (old.starts_at, old.ends_at, old.location, old.repeat_freq) then
    return new;
  end if;
  for v_user in
    select m.user_id from calendar.attendees a join core.tenant_members m on m.id = a.member_id
    where a.event_id = new.id and a.response <> 'declined' and m.user_id is distinct from (select auth.uid())
  loop
    perform core.notify(new.tenant_id, v_user, 'calendar.updated', 'Termin geändert: „' || new.title || '“',
      to_char(new.starts_at at time zone (select timezone from core.tenants where id = new.tenant_id), 'DD.MM.YYYY HH24:MI'),
      'kalender/termine/' || new.id);
  end loop;
  return new;
end $$;
create trigger events_notify_changed after update on calendar.events
  for each row execute function calendar.notify_changed();

-- Erinnerungen (alle 5 Minuten): Eigentümer bzw. Ersteller und alle nicht absagenden Eingeladenen
create or replace function calendar.send_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_row   record;
  v_user  uuid;
begin
  for v_row in
    select e.id, e.tenant_id, e.title, e.calendar_id, e.created_by, o.occurrence_start, t.timezone
    from calendar.events e
    join core.tenants t on t.id = e.tenant_id and t.status = 'active'
    cross join lateral calendar.occurrences(e, now(), now() + interval '28 days 1 hour', t.timezone) o
    where e.reminder_minutes is not null
      and (e.repeat_freq is not null or e.starts_at between now() and now() + interval '28 days 1 hour')
      and o.occurrence_start - make_interval(mins => e.reminder_minutes) <= now()
      and o.occurrence_start > now() - interval '5 minutes'
      and core.module_enabled(e.tenant_id, 'calendar')
      and not exists (select 1 from calendar.reminders_sent r where r.event_id = e.id and r.occurrence_start = o.occurrence_start)
  loop
    insert into calendar.reminders_sent (event_id, occurrence_start) values (v_row.id, v_row.occurrence_start)
    on conflict do nothing;
    for v_user in
      select distinct u from (
        select m.user_id as u from calendar.calendars c join core.tenant_members m on m.id = c.owner_member_id
        where c.id = v_row.calendar_id
        union select v_row.created_by
        union select m.user_id from calendar.attendees a join core.tenant_members m on m.id = a.member_id
        where a.event_id = v_row.id and a.response <> 'declined'
      ) x where u is not null
    loop
      perform core.notify(v_row.tenant_id, v_user, 'calendar.reminder', 'Erinnerung: „' || v_row.title || '“',
        to_char(v_row.occurrence_start at time zone v_row.timezone, 'DD.MM.YYYY HH24:MI'), 'kalender/termine/' || v_row.id);
    end loop;
    v_count := v_count + 1;
  end loop;
  delete from calendar.reminders_sent where occurrence_start < now() - interval '30 days';
  return v_count;
end $$;
select cron.schedule('nova-calendar-reminders', '*/5 * * * *', 'select calendar.send_reminders()');

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table calendar.calendars enable row level security;
alter table calendar.events enable row level security;
alter table calendar.attendees enable row level security;
alter table calendar.reminders_sent enable row level security;
alter table calendar.feed_tokens enable row level security;
-- reminders_sent, feed_tokens: kein direkter Zugriff (nur über Funktionen)

create policy calendars_select on calendar.calendars for select to authenticated using (calendar.can_view_calendar(id));
create policy calendars_update on calendar.calendars for update to authenticated
  using (calendar.can_edit_calendar(id)) with check (calendar.can_edit_calendar(id));

create policy events_select on calendar.events for select to authenticated using (calendar.can_view_event(id));
create policy events_insert on calendar.events for insert to authenticated
  with check (calendar.can_edit_calendar(calendar_id) and created_by = (select auth.uid()));
create policy events_update on calendar.events for update to authenticated
  using (calendar.can_edit_calendar(calendar_id)) with check (calendar.can_edit_calendar(calendar_id));
create policy events_delete on calendar.events for delete to authenticated using (calendar.can_edit_calendar(calendar_id));

create policy attendees_select on calendar.attendees for select to authenticated using (calendar.can_view_event(event_id));
create policy attendees_insert on calendar.attendees for insert to authenticated with check (calendar.can_edit_event(event_id));
create policy attendees_update on calendar.attendees for update to authenticated
  using (calendar.can_edit_event(event_id) or member_id = calendar.my_member_id(tenant_id))
  with check (calendar.can_edit_event(event_id) or member_id = calendar.my_member_id(tenant_id));
create policy attendees_delete on calendar.attendees for delete to authenticated using (calendar.can_edit_event(event_id));

-- =============================================================================
-- Rechte
-- =============================================================================
grant select, update on calendar.calendars to authenticated;
grant select, insert, update, delete on calendar.events, calendar.attendees to authenticated;
grant all on all tables in schema calendar to service_role;

revoke all on function calendar.ensure_company_calendar(uuid), calendar.on_member_added(), calendar.on_team_changed(),
  calendar.on_module_enabled(), calendar.protect_calendar(), calendar.prepare_event(), calendar.protect_attendee(),
  calendar.write_audit_log(), calendar.search_sync(), calendar.notify_invited(), calendar.notify_response(),
  calendar.notify_changed(), calendar.send_reminders() from public, anon, authenticated;
revoke all on function calendar.my_member_id(uuid), calendar.can_view_calendar(uuid), calendar.can_edit_calendar(uuid),
  calendar.is_attendee(uuid), calendar.can_view_event(uuid), calendar.can_edit_event(uuid),
  calendar.occurrences(calendar.events, timestamptz, timestamptz, text), calendar.agenda(uuid, timestamptz, timestamptz),
  calendar.busy(uuid, uuid[], timestamptz, timestamptz), calendar.respond(uuid, text), calendar.skip_occurrence(uuid, date),
  calendar.create_feed_token(uuid), calendar.revoke_feed_token(uuid), calendar.has_feed_token(uuid),
  calendar.feed_events(text) from public, anon;
grant execute on function calendar.my_member_id(uuid), calendar.can_view_calendar(uuid), calendar.can_edit_calendar(uuid),
  calendar.is_attendee(uuid), calendar.can_view_event(uuid), calendar.can_edit_event(uuid),
  calendar.occurrences(calendar.events, timestamptz, timestamptz, text), calendar.agenda(uuid, timestamptz, timestamptz),
  calendar.busy(uuid, uuid[], timestamptz, timestamptz), calendar.respond(uuid, text), calendar.skip_occurrence(uuid, date),
  calendar.create_feed_token(uuid), calendar.revoke_feed_token(uuid), calendar.has_feed_token(uuid) to authenticated;
-- Abo-Link: wird vom Server ohne Anmeldung (anon) mit dem geheimen Token aufgerufen
grant usage on schema calendar to anon;
grant execute on function calendar.feed_events(text) to anon, authenticated;
grant execute on function calendar.send_reminders() to service_role;

-- =============================================================================
-- Bestehende Unternehmen: Modul, Unternehmens-, Team- und persönliche Kalender
-- =============================================================================
insert into core.tenant_modules (tenant_id, module_key, enabled, source)
select id, 'calendar', true, 'included' from core.tenants
on conflict (tenant_id, module_key) do nothing;

select calendar.ensure_company_calendar(id) from core.tenants;

insert into calendar.calendars (tenant_id, kind, name, owner_member_id, color)
select tenant_id, 'personal', 'Mein Kalender', id, '#0ea5e9' from core.tenant_members
on conflict do nothing;

insert into calendar.calendars (tenant_id, kind, name, team_id, color)
select tenant_id, 'team', name, id, '#10b981' from core.teams
on conflict do nothing;
