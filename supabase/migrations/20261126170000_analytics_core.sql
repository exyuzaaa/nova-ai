-- =============================================================================
-- NOVA ANALYTICS – Kern: Organisationen, Mitglieder, Einladungen, Websites
-- -----------------------------------------------------------------------------
-- Eigenes Schema "analytics". Authentifizierung über Supabase Auth (auth.users).
-- Jede Zeile ist einer Organisation zugeordnet; Row Level Security trennt die
-- Datenräume. Schreibende Zugriffe auf Mitgliedschaften laufen ausschließlich
-- über geprüfte Funktionen (Einladung annehmen, Organisation anlegen).
-- =============================================================================

create schema if not exists analytics;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Typen
-- -----------------------------------------------------------------------------
-- Reihenfolge ist relevant: Enum-Vergleich (>=) bildet die Rollenhierarchie ab.
create type analytics.member_role as enum ('viewer', 'analyst', 'admin', 'owner');

create type analytics.traffic_channel as enum (
  'organic_search', 'paid_search', 'direct', 'referral',
  'social', 'email', 'display', 'unassigned'
);

-- cookieless       : keine Speicherung auf dem Endgerät, täglich rotierender Hash.
-- consent_upgrade  : cookieless als Basis; nach Einwilligung persistente pseudonyme ID.
-- consent_required : ohne Einwilligung wird nichts erfasst.
create type analytics.tracking_mode as enum ('cookieless', 'consent_upgrade', 'consent_required');

create type analytics.visitor_id_type as enum ('daily_hash', 'consented_id');

create type analytics.match_operator as enum ('equals', 'starts_with', 'contains', 'regex');

create or replace function analytics.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =============================================================================
-- Tabellen
-- =============================================================================
create table analytics.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 120),
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  plan            text not null default 'free',
  ai_enabled      boolean not null default false,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create trigger organizations_updated_at before update on analytics.organizations
  for each row execute function analytics.set_updated_at();

create table analytics.organization_branding (
  organization_id    uuid primary key references analytics.organizations(id) on delete cascade,
  display_name       text,
  logo_storage_path  text,
  primary_color      text check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  report_footer      text check (char_length(report_footer) <= 500),
  email_sender_name  text,
  hide_nova_branding boolean not null default false,
  updated_at         timestamptz not null default now()
);
create trigger organization_branding_updated_at before update on analytics.organization_branding
  for each row execute function analytics.set_updated_at();

create table analytics.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            analytics.member_role not null default 'viewer',
  invited_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on analytics.organization_members (user_id);
create trigger organization_members_updated_at before update on analytics.organization_members
  for each row execute function analytics.set_updated_at();

create table analytics.organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  email           text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            analytics.member_role not null default 'viewer' check (role <> 'owner'),
  token_hash      text not null unique,              -- nur SHA-256 des Einladungstokens
  invited_by      uuid references auth.users(id) on delete set null,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index organization_invitations_org_idx on analytics.organization_invitations (organization_id)
  where accepted_at is null;

create table analytics.websites (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references analytics.organizations(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  domain             text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  additional_domains text[] not null default '{}',
  public_site_id     text not null unique
                       default 'ns_' || encode(extensions.gen_random_bytes(8), 'hex')
                       check (public_site_id ~ '^ns_[a-z0-9]{16}$'),
  timezone           text not null default 'Europe/Berlin',
  currency           char(3) not null default 'EUR',
  is_demo            boolean not null default false,
  status             text not null default 'active' check (status in ('active', 'paused')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create index websites_org_idx on analytics.websites (organization_id) where deleted_at is null;
create trigger websites_updated_at before update on analytics.websites
  for each row execute function analytics.set_updated_at();

create table analytics.organization_member_websites (
  member_id  uuid not null references analytics.organization_members(id) on delete cascade,
  website_id uuid not null references analytics.websites(id) on delete cascade,
  primary key (member_id, website_id)
);

create table analytics.tracking_settings (
  website_id               uuid primary key references analytics.websites(id) on delete cascade,
  tracking_mode            analytics.tracking_mode not null default 'cookieless',
  spa_tracking             boolean not null default true,
  track_scroll_depth       boolean not null default false,
  track_outbound_clicks    boolean not null default true,
  track_downloads          boolean not null default true,
  track_form_interactions  boolean not null default false,
  track_contact_clicks     boolean not null default true,
  respect_gpc_dnt          boolean not null default true,
  excluded_paths           text[] not null default '{}',
  query_param_allowlist    text[] not null default '{}',
  allowed_origins          text[] not null default '{}',
  geo_granularity          text not null default 'region' check (geo_granularity in ('country', 'region', 'city')),
  session_timeout_minutes  smallint not null default 30 check (session_timeout_minutes between 5 and 240),
  heartbeat_seconds        smallint not null default 30 check (heartbeat_seconds between 10 and 120),
  raw_retention_days       integer not null default 395 check (raw_retention_days between 30 and 1095),
  aggregate_retention_days integer check (aggregate_retention_days is null or aggregate_retention_days >= 365),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users(id) on delete set null
);
create trigger tracking_settings_updated_at before update on analytics.tracking_settings
  for each row execute function analytics.set_updated_at();

create table analytics.api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references analytics.organizations(id) on delete cascade,
  website_id      uuid references analytics.websites(id) on delete cascade,
  name            text not null,
  key_prefix      text not null,
  key_hash        text not null unique,
  scopes          text[] not null default '{events:write}',
  created_by      uuid references auth.users(id) on delete set null,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table analytics.consent_records (
  id             uuid primary key default gen_random_uuid(),
  website_id     uuid not null references analytics.websites(id) on delete cascade,
  consent_id     uuid not null,
  decision       text not null check (decision in ('granted', 'denied', 'withdrawn')),
  categories     jsonb not null default '{}',
  policy_version text not null,
  source         text not null check (source in ('nova_banner', 'cmp_bridge', 'api')),
  recorded_at    timestamptz not null default now()
);
create index consent_records_site_time_idx on analytics.consent_records (website_id, recorded_at desc);
create index consent_records_consent_idx on analytics.consent_records (consent_id);

create table analytics.audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid references analytics.organizations(id) on delete set null,
  actor_type      text not null check (actor_type in ('user', 'api_key', 'system')),
  actor_id        uuid,
  action          text not null,
  target_type     text,
  target_id       text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index audit_logs_org_time_idx on analytics.audit_logs (organization_id, created_at desc);

-- =============================================================================
-- Autorisierung (Grundlage aller Policies)
-- =============================================================================
-- security definer + leerer search_path: keine RLS-Rekursion, kein search_path-Hijacking.
create or replace function analytics.has_org_role(p_org uuid, p_min analytics.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from analytics.organization_members m
    join analytics.organizations o on o.id = m.organization_id and o.deleted_at is null
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role >= p_min
  );
$$;

-- Websites, auf die der aktuelle Nutzer mindestens mit p_min zugreifen darf
-- (inkl. optionaler Website-Beschränkung je Mitglied; Admins sind nie beschränkt).
create or replace function analytics.accessible_website_ids(p_min analytics.member_role)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select w.id
  from analytics.websites w
  join analytics.organizations o on o.id = w.organization_id and o.deleted_at is null
  join analytics.organization_members m
    on m.organization_id = w.organization_id
   and m.user_id = (select auth.uid())
   and m.role >= p_min
  where w.deleted_at is null
    and (
      m.role >= 'admin'
      or not exists (select 1 from analytics.organization_member_websites r where r.member_id = m.id)
      or exists (select 1 from analytics.organization_member_websites r
                 where r.member_id = m.id and r.website_id = w.id)
    );
$$;

-- =============================================================================
-- Schutzregeln für Mitgliedschaften
-- =============================================================================
create or replace function analytics.protect_last_owner()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid := coalesce(old.organization_id, new.organization_id);
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (
      select 1 from analytics.organization_members
      where organization_id = v_org and role = 'owner' and id <> old.id
    ) and exists (select 1 from analytics.organizations where id = v_org) then
      raise exception 'Eine Organisation braucht mindestens einen Owner' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger organization_members_protect_owner
  before update or delete on analytics.organization_members
  for each row execute function analytics.protect_last_owner();

-- Nur Owner dürfen Owner-Rollen vergeben, ändern oder entziehen. Geprüft werden
-- direkte Änderungen durch Endnutzer (Rolle "authenticated"); geprüfte Funktionen
-- und Kaskaden laufen als Eigentümer und sind davon ausgenommen.
create or replace function analytics.guard_owner_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Mitgliedschaften können nicht umgehängt werden' using errcode = '42501';
  end if;
  if (tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner') then
    -- Ein Owner darf die eigene Mitgliedschaft beenden (Schutz des letzten Owners greift separat).
    if not (tg_op = 'DELETE' and old.user_id = (select auth.uid()))
       and not analytics.has_org_role(coalesce(new.organization_id, old.organization_id), 'owner') then
      raise exception 'Nur Owner dürfen Owner-Rollen vergeben oder ändern' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger organization_members_guard_owner
  before insert or update or delete on analytics.organization_members
  for each row execute function analytics.guard_owner_changes();

-- Jede neue Website erhält sofort Tracking-Einstellungen mit datensparsamen Standards.
create or replace function analytics.create_default_tracking_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into analytics.tracking_settings (website_id, updated_by)
  values (new.id, (select auth.uid()))
  on conflict (website_id) do nothing;
  return new;
end $$;
create trigger websites_default_tracking_settings
  after insert on analytics.websites
  for each row execute function analytics.create_default_tracking_settings();

-- =============================================================================
-- Audit-Log (per Trigger, nicht umgehbar)
-- =============================================================================
create or replace function analytics.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row     jsonb := to_jsonb(coalesce(new, old));
  v_old     jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_org     uuid;
  v_action  text := tg_table_name || '.' || lower(tg_op);
  v_meta    jsonb := '{}';
begin
  v_org := coalesce(
    (v_row ->> 'organization_id')::uuid,
    case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid end,
    case when tg_table_name = 'tracking_settings' then
      (select w.organization_id from analytics.websites w where w.id = (v_row ->> 'website_id')::uuid) end
  );
  -- Nur fachlich relevante Felder protokollieren; keine Token-Hashes.
  if tg_table_name = 'organization_members' then
    v_meta := jsonb_build_object('user_id', v_row ->> 'user_id', 'role', v_row ->> 'role',
                                 'previous_role', v_old ->> 'role');
  elsif tg_table_name = 'organization_invitations' then
    v_meta := jsonb_build_object('email', v_row ->> 'email', 'role', v_row ->> 'role',
                                 'accepted', (v_row ->> 'accepted_at') is not null);
  elsif tg_table_name = 'websites' then
    v_meta := jsonb_build_object('name', v_row ->> 'name', 'domain', v_row ->> 'domain',
                                 'deleted', (v_row ->> 'deleted_at') is not null);
  elsif tg_table_name = 'organizations' then
    v_meta := jsonb_build_object('name', v_row ->> 'name');
  end if;

  insert into analytics.audit_logs (organization_id, actor_type, actor_id, action, target_type, target_id, metadata)
  values (
    v_org,
    case when (select auth.uid()) is null then 'system' else 'user' end,
    (select auth.uid()),
    v_action,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'website_id'),
    v_meta
  );
  return coalesce(new, old);
end $$;

create trigger organizations_audit after insert or update on analytics.organizations
  for each row execute function analytics.write_audit_log();
create trigger organization_members_audit after insert or update or delete on analytics.organization_members
  for each row execute function analytics.write_audit_log();
create trigger organization_invitations_audit after insert or update or delete on analytics.organization_invitations
  for each row execute function analytics.write_audit_log();
create trigger websites_audit after insert or update on analytics.websites
  for each row execute function analytics.write_audit_log();
create trigger tracking_settings_audit after update on analytics.tracking_settings
  for each row execute function analytics.write_audit_log();

-- =============================================================================
-- Geprüfte Funktionen (RPC)
-- =============================================================================

-- Organisation anlegen; der Aufrufer wird Owner.
create or replace function analytics.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  insert into analytics.organizations (name, slug) values (btrim(p_name), p_slug) returning id into v_org;
  insert into analytics.organization_members (organization_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end $$;

-- Einladung erstellen (ab Admin). Gibt das Token EINMALIG zurück; gespeichert wird nur der Hash.
create or replace function analytics.create_invitation(
  p_org uuid,
  p_email text,
  p_role analytics.member_role default 'viewer'
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if not analytics.has_org_role(p_org, 'admin') then
    raise exception 'Keine Berechtigung, Mitglieder einzuladen' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Die Owner-Rolle kann nicht per Einladung vergeben werden' using errcode = '22023';
  end if;
  if exists (
    select 1 from analytics.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org and lower(u.email) = v_email
  ) then
    raise exception 'Diese Person ist bereits Mitglied' using errcode = '23505';
  end if;

  -- Offene Einladung an dieselbe Adresse ersetzen
  delete from analytics.organization_invitations
  where organization_id = p_org and lower(email) = v_email and accepted_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into analytics.organization_invitations (organization_id, email, role, token_hash, invited_by, expires_at)
  values (p_org, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'),
          (select auth.uid()), now() + interval '7 days');
  return v_token;
end $$;

-- Einladung anzeigen (ohne Anmeldung nicht aufrufbar; das Token ist der Nachweis).
create or replace function analytics.get_invitation(p_token text)
returns table (organization_name text, email text, role analytics.member_role, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select o.name, i.email, i.role, i.expires_at,
         case
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'pending'
         end
  from analytics.organization_invitations i
  join analytics.organizations o on o.id = i.organization_id and o.deleted_at is null
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Einladung annehmen. Nur mit der eingeladenen (und bestätigten) E-Mail-Adresse.
create or replace function analytics.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_inv   analytics.organization_invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'E-Mail-Adresse ist noch nicht bestätigt' using errcode = '42501';
  end if;

  select * into v_inv from analytics.organization_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Einladung ist ungültig oder abgelaufen' using errcode = 'P0002';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse' using errcode = '42501';
  end if;

  insert into analytics.organization_members (organization_id, user_id, role, invited_by)
  values (v_inv.organization_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (organization_id, user_id) do nothing;

  update analytics.organization_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.organization_id;
end $$;

-- Mitglieder mit E-Mail-Adresse (auth.users ist für Clients nicht lesbar).
create or replace function analytics.list_members(p_org uuid)
returns table (
  member_id  uuid,
  user_id    uuid,
  email      text,
  role       analytics.member_role,
  created_at timestamptz,
  is_self    boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not analytics.has_org_role(p_org, 'viewer') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, u.email::text, m.role, m.created_at, m.user_id = (select auth.uid())
    from analytics.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_org
    order by m.role desc, u.email;
end $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table analytics.organizations enable row level security;
alter table analytics.organization_branding enable row level security;
alter table analytics.organization_members enable row level security;
alter table analytics.organization_invitations enable row level security;
alter table analytics.websites enable row level security;
alter table analytics.organization_member_websites enable row level security;
alter table analytics.tracking_settings enable row level security;
alter table analytics.api_keys enable row level security;
alter table analytics.consent_records enable row level security;
alter table analytics.audit_logs enable row level security;

-- Organisationen (Anlegen nur über create_organization; Löschen nur serverseitig)
create policy org_select on analytics.organizations for select to authenticated
  using (deleted_at is null and analytics.has_org_role(id, 'viewer'));
create policy org_update on analytics.organizations for update to authenticated
  using (analytics.has_org_role(id, 'admin')) with check (analytics.has_org_role(id, 'admin'));

create policy branding_select on analytics.organization_branding for select to authenticated
  using (analytics.has_org_role(organization_id, 'viewer'));
create policy branding_write on analytics.organization_branding for all to authenticated
  using (analytics.has_org_role(organization_id, 'admin'))
  with check (analytics.has_org_role(organization_id, 'admin'));

-- Mitglieder: Lesen ab Viewer; Rolle ändern/entfernen ab Admin; jeder darf austreten.
-- Hinzufügen ausschließlich über accept_invitation / create_organization.
create policy members_select on analytics.organization_members for select to authenticated
  using (analytics.has_org_role(organization_id, 'viewer'));
create policy members_update on analytics.organization_members for update to authenticated
  using (analytics.has_org_role(organization_id, 'admin'))
  with check (analytics.has_org_role(organization_id, 'admin'));
create policy members_delete on analytics.organization_members for delete to authenticated
  using (analytics.has_org_role(organization_id, 'admin') or user_id = (select auth.uid()));

-- Einladungen: Admins sehen und widerrufen; erstellen nur über create_invitation
create policy invitations_select on analytics.organization_invitations for select to authenticated
  using (analytics.has_org_role(organization_id, 'admin'));
create policy invitations_delete on analytics.organization_invitations for delete to authenticated
  using (analytics.has_org_role(organization_id, 'admin'));

create policy member_websites_select on analytics.organization_member_websites for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy member_websites_write on analytics.organization_member_websites for all to authenticated
  using (website_id in (select analytics.accessible_website_ids('admin')))
  with check (website_id in (select analytics.accessible_website_ids('admin')));

-- Websites: Lesen gemäß Zugriff; Anlegen/Ändern ab Admin; kein hartes Löschen
create policy websites_select on analytics.websites for select to authenticated
  using (id in (select analytics.accessible_website_ids('viewer')));
create policy websites_insert on analytics.websites for insert to authenticated
  with check (analytics.has_org_role(organization_id, 'admin') and not is_demo);
create policy websites_update on analytics.websites for update to authenticated
  using (id in (select analytics.accessible_website_ids('admin')))
  with check (analytics.has_org_role(organization_id, 'admin'));

create policy tracking_settings_select on analytics.tracking_settings for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('viewer')));
create policy tracking_settings_update on analytics.tracking_settings for update to authenticated
  using (website_id in (select analytics.accessible_website_ids('admin')))
  with check (website_id in (select analytics.accessible_website_ids('admin')));

create policy api_keys_select on analytics.api_keys for select to authenticated
  using (analytics.has_org_role(organization_id, 'admin'));
create policy consent_select on analytics.consent_records for select to authenticated
  using (website_id in (select analytics.accessible_website_ids('admin')));
create policy audit_select on analytics.audit_logs for select to authenticated
  using (analytics.has_org_role(organization_id, 'admin'));

-- =============================================================================
-- Rechte: anon erhält nichts; authenticated nur, was Policies erlauben
-- =============================================================================
revoke all on schema analytics from public, anon;
revoke all on all tables in schema analytics from public, anon, authenticated;
revoke all on all functions in schema analytics from public, anon, authenticated;
alter default privileges in schema analytics revoke all on tables from public, anon, authenticated;
alter default privileges in schema analytics revoke execute on functions from public, anon, authenticated;

grant usage on schema analytics to authenticated, service_role;
grant select on
  analytics.organizations, analytics.organization_branding, analytics.organization_members,
  analytics.organization_invitations, analytics.websites, analytics.organization_member_websites,
  analytics.tracking_settings, analytics.api_keys, analytics.consent_records, analytics.audit_logs
  to authenticated;
grant update (name) on analytics.organizations to authenticated;
grant insert, update, delete on analytics.organization_branding to authenticated;
grant update (role), delete on analytics.organization_members to authenticated;
grant delete on analytics.organization_invitations to authenticated;
-- id darf mitgegeben werden: INSERT … RETURNING scheitert an der SELECT-Policy, weil
-- accessible_website_ids() die neue Zeile im selben Statement noch nicht sieht.
grant insert (id, organization_id, name, domain, additional_domains, timezone, currency),
      update (name, domain, additional_domains, timezone, currency, status, deleted_at)
  on analytics.websites to authenticated;
grant insert, delete on analytics.organization_member_websites to authenticated;
grant update (tracking_mode, spa_tracking, track_scroll_depth, track_outbound_clicks, track_downloads,
              track_form_interactions, track_contact_clicks, respect_gpc_dnt, excluded_paths,
              query_param_allowlist, allowed_origins, geo_granularity, session_timeout_minutes,
              heartbeat_seconds, raw_retention_days, aggregate_retention_days, updated_by)
  on analytics.tracking_settings to authenticated;

grant all on all tables in schema analytics to service_role;
grant usage on all sequences in schema analytics to service_role;
-- Audit-Log ist append-only, auch für service_role
revoke update, delete, truncate on analytics.audit_logs from service_role;

grant execute on function analytics.has_org_role(uuid, analytics.member_role) to authenticated, service_role;
grant execute on function analytics.accessible_website_ids(analytics.member_role) to authenticated, service_role;
grant execute on function analytics.create_organization(text, text) to authenticated;
grant execute on function analytics.create_invitation(uuid, text, analytics.member_role) to authenticated;
grant execute on function analytics.get_invitation(text) to authenticated;
grant execute on function analytics.accept_invitation(text) to authenticated;
grant execute on function analytics.list_members(uuid) to authenticated;
