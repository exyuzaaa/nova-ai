-- =============================================================================
-- NOVA CORE – Gemeinsamer Kern für alle Module (Plattform-Phase 1a)
-- -----------------------------------------------------------------------------
-- Die Mandanten-Tabellen lagen bisher im Schema "analytics". Sie werden hier in
-- das neue Schema "core" VERSCHOBEN (keine Kopie): IDs, Daten, Fremdschlüssel und
-- Rechte bleiben erhalten. Alle Analytics-Tabellen behalten ihre Spalte
-- organization_id; deren Fremdschlüssel zeigt danach auf core.tenants.
--
--   analytics.organizations            -> core.tenants
--   analytics.organization_branding    -> core.tenant_branding   (tenant_id)
--   analytics.organization_members     -> core.tenant_members    (tenant_id)
--   analytics.organization_invitations -> core.invitations       (tenant_id)
--   analytics.audit_logs               -> core.audit_logs        (tenant_id)
--   analytics.member_role              -> core.member_role ('analyst' heißt 'member')
--
-- analytics.has_org_role bleibt als Hülle um core.has_tenant_role bestehen, damit
-- sämtliche Analytics-Policies unverändert weitergelten. Neu angelegt werden nur
-- Funktionen, deren Quelltext die alten Tabellennamen enthält.
--
-- Zusätzlich werden die (noch leeren) Schemas aller geplanten Module angelegt,
-- damit sie in Supabase einmalig unter „Data API → Exposed schemas“ freigegeben
-- werden können.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schemas
-- -----------------------------------------------------------------------------
do $$
declare
  s text;
begin
  foreach s in array array['core', 'billing', 'platform', 'crm', 'projects', 'calendar', 'hr', 'finance',
                           'documents', 'messaging', 'support', 'inventory', 'marketing', 'automation'] loop
    execute format('create schema if not exists %I', s);
    execute format('revoke all on schema %I from public, anon', s);
    execute format('grant usage on schema %I to authenticated, service_role', s);
    -- Neue Tabellen/Funktionen sind zunächst für niemanden außer service_role nutzbar;
    -- jedes Modul vergibt Rechte ausdrücklich und schützt Zeilen per RLS.
    execute format('alter default privileges in schema %I revoke all on tables from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I revoke execute on functions from public, anon, authenticated', s);
    execute format('alter default privileges in schema %I grant all on tables to service_role', s);
    execute format('alter default privileges in schema %I grant usage on sequences to service_role', s);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Typen und Tabellen verschieben
-- -----------------------------------------------------------------------------
alter type analytics.member_role set schema core;
alter type core.member_role rename value 'analyst' to 'member';

alter table analytics.organizations set schema core;
alter table core.organizations rename to tenants;

alter table analytics.organization_branding set schema core;
alter table core.organization_branding rename to tenant_branding;
alter table core.tenant_branding rename column organization_id to tenant_id;

alter table analytics.organization_members set schema core;
alter table core.organization_members rename to tenant_members;
alter table core.tenant_members rename column organization_id to tenant_id;
alter index core.organization_members_user_idx rename to tenant_members_user_idx;

alter table analytics.organization_invitations set schema core;
alter table core.organization_invitations rename to invitations;
alter table core.invitations rename column organization_id to tenant_id;
alter index core.organization_invitations_org_idx rename to invitations_tenant_open_idx;

alter table analytics.audit_logs set schema core;
alter table core.audit_logs rename column organization_id to tenant_id;
alter index core.audit_logs_org_time_idx rename to audit_logs_tenant_time_idx;

-- Alte Trigger und Policies der verschobenen Tabellen entfernen (werden unten neu angelegt)
drop trigger organizations_updated_at on core.tenants;
drop trigger organizations_audit on core.tenants;
drop trigger organization_branding_updated_at on core.tenant_branding;
drop trigger organization_members_updated_at on core.tenant_members;
drop trigger organization_members_protect_owner on core.tenant_members;
drop trigger organization_members_guard_owner on core.tenant_members;
drop trigger organization_members_audit on core.tenant_members;
drop trigger organization_invitations_audit on core.invitations;

drop policy org_select on core.tenants;
drop policy org_update on core.tenants;
drop policy branding_select on core.tenant_branding;
drop policy branding_write on core.tenant_branding;
drop policy members_select on core.tenant_members;
drop policy members_update on core.tenant_members;
drop policy members_delete on core.tenant_members;
drop policy invitations_select on core.invitations;
drop policy invitations_delete on core.invitations;
drop policy audit_select on core.audit_logs;

-- Ersetzt durch Funktionen in core
drop function analytics.create_organization(text, text);
drop function analytics.create_invitation(uuid, text, core.member_role);
drop function analytics.get_invitation(text);
drop function analytics.accept_invitation(text);
drop function analytics.list_members(uuid);
drop function analytics.protect_last_owner();
drop function analytics.guard_owner_changes();

-- =============================================================================
-- Basisfunktionen
-- =============================================================================
create or replace function core.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Mindestrolle im Mandanten. security definer + leerer search_path: keine
-- RLS-Rekursion, kein search_path-Hijacking. Gelöschte Mandanten zählen nicht.
create or replace function core.has_tenant_role(p_tenant uuid, p_min core.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.tenant_members m
    join core.tenants t on t.id = m.tenant_id and t.deleted_at is null
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.role >= p_min
  );
$$;

-- Ein Eintrag im Audit-Log. Nur für Trigger und geprüfte Funktionen (nicht für Clients).
create or replace function core.log_audit(
  p_tenant      uuid,
  p_action      text,
  p_target_type text,
  p_target_id   text,
  p_metadata    jsonb default '{}'
)
returns void language sql security definer set search_path = '' as $$
  insert into core.audit_logs (tenant_id, actor_type, actor_id, action, target_type, target_id, metadata)
  values (p_tenant,
          case when (select auth.uid()) is null then 'system' else 'user' end,
          (select auth.uid()),
          p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

-- Audit-Trigger für Kern-Tabellen. Protokolliert nur fachlich relevante Felder, keine Token-Hashes.
create or replace function core.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row    jsonb := to_jsonb(coalesce(new, old));
  v_old    jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_tenant uuid;
  v_meta   jsonb := '{}';
begin
  v_tenant := coalesce(
    (v_row ->> 'tenant_id')::uuid,
    case when tg_table_name = 'tenants' then (v_row ->> 'id')::uuid end
  );
  if tg_table_name = 'tenant_members' then
    v_meta := jsonb_build_object('user_id', v_row ->> 'user_id', 'role', v_row ->> 'role',
                                 'previous_role', v_old ->> 'role');
  elsif tg_table_name = 'invitations' then
    v_meta := jsonb_build_object('email', v_row ->> 'email', 'role', v_row ->> 'role',
                                 'accepted', (v_row ->> 'accepted_at') is not null);
  elsif tg_table_name = 'tenants' then
    v_meta := jsonb_build_object('name', v_row ->> 'name');
  end if;
  perform core.log_audit(v_tenant, tg_table_name || '.' || lower(tg_op), tg_table_name, v_row ->> 'id', v_meta);
  return coalesce(new, old);
end $$;

-- =============================================================================
-- Schutzregeln für Mitgliedschaften
-- =============================================================================
create or replace function core.protect_last_owner()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_tenant uuid := coalesce(old.tenant_id, new.tenant_id);
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if not exists (
      select 1 from core.tenant_members
      where tenant_id = v_tenant and role = 'owner' and id <> old.id
    ) and exists (select 1 from core.tenants where id = v_tenant) then
      raise exception 'Ein Unternehmen braucht mindestens einen Owner' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;

-- Nur Owner dürfen Owner-Rollen vergeben, ändern oder entziehen. Geprüft werden
-- direkte Änderungen durch Endnutzer (Rolle "authenticated"); geprüfte Funktionen
-- und Kaskaden laufen als Eigentümer und sind davon ausgenommen.
create or replace function core.guard_owner_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' or (select auth.uid()) is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.tenant_id <> old.tenant_id) then
    raise exception 'Mitgliedschaften können nicht umgehängt werden' using errcode = '42501';
  end if;
  if (tg_op <> 'INSERT' and old.role = 'owner') or (tg_op <> 'DELETE' and new.role = 'owner') then
    -- Ein Owner darf die eigene Mitgliedschaft beenden (Schutz des letzten Owners greift separat).
    if not (tg_op = 'DELETE' and old.user_id = (select auth.uid()))
       and not core.has_tenant_role(coalesce(new.tenant_id, old.tenant_id), 'owner') then
      raise exception 'Nur Owner dürfen Owner-Rollen vergeben oder ändern' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end $$;

-- =============================================================================
-- Trigger
-- =============================================================================
create trigger tenants_updated_at before update on core.tenants
  for each row execute function core.set_updated_at();
create trigger tenant_branding_updated_at before update on core.tenant_branding
  for each row execute function core.set_updated_at();
create trigger tenant_members_updated_at before update on core.tenant_members
  for each row execute function core.set_updated_at();
create trigger tenant_members_protect_owner before update or delete on core.tenant_members
  for each row execute function core.protect_last_owner();
create trigger tenant_members_guard_owner before insert or update or delete on core.tenant_members
  for each row execute function core.guard_owner_changes();

create trigger tenants_audit after insert or update on core.tenants
  for each row execute function core.write_audit_log();
create trigger tenant_members_audit after insert or update or delete on core.tenant_members
  for each row execute function core.write_audit_log();
create trigger invitations_audit after insert or update or delete on core.invitations
  for each row execute function core.write_audit_log();

-- =============================================================================
-- Geprüfte Funktionen (RPC)
-- =============================================================================

-- Unternehmen anlegen; der Aufrufer wird Owner.
create or replace function core.create_tenant(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  insert into core.tenants (name, slug) values (btrim(p_name), p_slug) returning id into v_tenant;
  insert into core.tenant_members (tenant_id, user_id, role) values (v_tenant, v_uid, 'owner');
  return v_tenant;
end $$;

-- Einladung erstellen (ab Admin). Gibt das Token EINMALIG zurück; gespeichert wird nur der Hash.
create or replace function core.create_invitation(
  p_tenant uuid,
  p_email  text,
  p_role   core.member_role default 'viewer'
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_token text;
begin
  if not core.has_tenant_role(p_tenant, 'admin') then
    raise exception 'Keine Berechtigung, Mitglieder einzuladen' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Die Owner-Rolle kann nicht per Einladung vergeben werden' using errcode = '22023';
  end if;
  if exists (
    select 1 from core.tenant_members m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant and lower(u.email) = v_email
  ) then
    raise exception 'Diese Person ist bereits Mitglied' using errcode = '23505';
  end if;

  -- Offene Einladung an dieselbe Adresse ersetzen
  delete from core.invitations
  where tenant_id = p_tenant and lower(email) = v_email and accepted_at is null;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into core.invitations (tenant_id, email, role, token_hash, invited_by, expires_at)
  values (p_tenant, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'),
          (select auth.uid()), now() + interval '7 days');
  return v_token;
end $$;

-- Einladung anzeigen (nur angemeldet; das Token ist der Nachweis).
create or replace function core.get_invitation(p_token text)
returns table (tenant_name text, email text, role core.member_role, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select t.name, i.email, i.role, i.expires_at,
         case
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'pending'
         end
  from core.invitations i
  join core.tenants t on t.id = i.tenant_id and t.deleted_at is null
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Einladung annehmen. Nur mit der eingeladenen (und bestätigten) E-Mail-Adresse.
create or replace function core.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_inv   core.invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'E-Mail-Adresse ist noch nicht bestätigt' using errcode = '42501';
  end if;

  select * into v_inv from core.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Einladung ist ungültig oder abgelaufen' using errcode = 'P0002';
  end if;
  if lower(v_inv.email) <> v_email then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse' using errcode = '42501';
  end if;

  insert into core.tenant_members (tenant_id, user_id, role, invited_by)
  values (v_inv.tenant_id, v_uid, v_inv.role, v_inv.invited_by)
  on conflict (tenant_id, user_id) do nothing;

  update core.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  return v_inv.tenant_id;
end $$;

-- Mitglieder mit E-Mail-Adresse (auth.users ist für Clients nicht lesbar).
create or replace function core.list_members(p_tenant uuid)
returns table (
  member_id  uuid,
  user_id    uuid,
  email      text,
  role       core.member_role,
  created_at timestamptz,
  is_self    boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not core.has_tenant_role(p_tenant, 'viewer') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, u.email::text, m.role, m.created_at, m.user_id = (select auth.uid())
    from core.tenant_members m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant
    order by m.role desc, u.email;
end $$;

-- =============================================================================
-- Row Level Security (Kern)
-- =============================================================================
-- Unternehmen: Anlegen nur über create_tenant; Löschen nur serverseitig
create policy tenants_select on core.tenants for select to authenticated
  using (deleted_at is null and core.has_tenant_role(id, 'viewer'));
create policy tenants_update on core.tenants for update to authenticated
  using (core.has_tenant_role(id, 'admin')) with check (core.has_tenant_role(id, 'admin'));

create policy tenant_branding_select on core.tenant_branding for select to authenticated
  using (core.has_tenant_role(tenant_id, 'viewer'));
create policy tenant_branding_write on core.tenant_branding for all to authenticated
  using (core.has_tenant_role(tenant_id, 'admin'))
  with check (core.has_tenant_role(tenant_id, 'admin'));

-- Mitglieder: Lesen ab Viewer; Rolle ändern/entfernen ab Admin; jeder darf austreten.
-- Hinzufügen ausschließlich über accept_invitation / create_tenant.
create policy tenant_members_select on core.tenant_members for select to authenticated
  using (core.has_tenant_role(tenant_id, 'viewer'));
create policy tenant_members_update on core.tenant_members for update to authenticated
  using (core.has_tenant_role(tenant_id, 'admin'))
  with check (core.has_tenant_role(tenant_id, 'admin'));
create policy tenant_members_delete on core.tenant_members for delete to authenticated
  using (core.has_tenant_role(tenant_id, 'admin') or user_id = (select auth.uid()));

-- Einladungen: Admins sehen und widerrufen; erstellen nur über create_invitation
create policy invitations_select on core.invitations for select to authenticated
  using (core.has_tenant_role(tenant_id, 'admin'));
create policy invitations_delete on core.invitations for delete to authenticated
  using (core.has_tenant_role(tenant_id, 'admin'));

create policy audit_logs_select on core.audit_logs for select to authenticated
  using (core.has_tenant_role(tenant_id, 'admin'));

-- =============================================================================
-- Analytics auf den Kern umstellen
-- =============================================================================
-- Hülle: alle bestehenden Analytics-Policies rufen diese Funktion auf.
create or replace function analytics.has_org_role(p_org uuid, p_min core.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select core.has_tenant_role(p_org, p_min);
$$;

create or replace function analytics.accessible_website_ids(p_min core.member_role)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select w.id
  from analytics.websites w
  join core.tenants t on t.id = w.organization_id and t.deleted_at is null
  join core.tenant_members m
    on m.tenant_id = w.organization_id
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

-- Audit für Websites und Tracking-Einstellungen schreibt in das gemeinsame Protokoll.
create or replace function analytics.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row  jsonb := to_jsonb(coalesce(new, old));
  v_org  uuid;
  v_meta jsonb := '{}';
begin
  v_org := coalesce(
    (v_row ->> 'organization_id')::uuid,
    case when tg_table_name = 'tracking_settings' then
      (select w.organization_id from analytics.websites w where w.id = (v_row ->> 'website_id')::uuid) end
  );
  if tg_table_name = 'websites' then
    v_meta := jsonb_build_object('name', v_row ->> 'name', 'domain', v_row ->> 'domain',
                                 'deleted', (v_row ->> 'deleted_at') is not null);
  end if;
  perform core.log_audit(v_org, tg_table_name || '.' || lower(tg_op), tg_table_name,
                         coalesce(v_row ->> 'id', v_row ->> 'website_id'), v_meta);
  return coalesce(new, old);
end $$;

-- Erfassung: Funktion unverändert bis auf core.tenants statt analytics.organizations.
create or replace function public.nova_ingest_event(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_site      record;
  v_type      text := p ->> 'type';
  v_name      text := left(coalesce(nullif(p ->> 'name', ''), p ->> 'type'), 80);
  v_host      text := lower(regexp_replace(coalesce(p ->> 'hostname', ''), '^www\.', ''));
  v_path      text := left(coalesce(nullif(p ->> 'pathname', ''), '/'), 2048);
  v_salt      bytea;
  v_hash      bytea;
  v_session   record;
  v_session_id uuid;
  v_started   timestamptz;
  v_now       timestamptz := now();
  v_props     jsonb := coalesce(p -> 'props', '{}'::jsonb);
  v_engage    integer := least(greatest(coalesce((p ->> 'engagement_ms')::integer, 0), 0), 1800000);
  v_new_campaign boolean;
begin
  -- Grundprüfungen ----------------------------------------------------------
  if v_type is null or v_type not in ('pageview', 'engagement', 'custom', 'outbound_click', 'download',
                                      'form_start', 'form_submit', 'scroll', 'phone_click', 'email_click',
                                      'heartbeat') then
    return 'invalid';
  end if;
  if coalesce(p ->> 'ip', '') = '' or coalesce(p ->> 'site_id', '') !~ '^ns_[a-f0-9]{16}$' then
    return 'invalid';
  end if;
  if jsonb_typeof(v_props) <> 'object' or length(v_props::text) > 4000 then
    v_props := '{}'::jsonb;
  end if;

  select w.id, w.organization_id, w.domain, w.additional_domains, s.*
  into v_site
  from analytics.websites w
  join core.tenants o on o.id = w.organization_id and o.deleted_at is null
  join analytics.tracking_settings s on s.website_id = w.id
  where w.public_site_id = p ->> 'site_id' and w.status = 'active' and w.deleted_at is null;
  if not found then
    return 'unknown_site';
  end if;

  -- Nur Events von der eigenen Domain (inkl. Subdomains und Zusatzdomains)
  if not (v_host = v_site.domain or v_host like '%.' || v_site.domain
          or v_host = any (v_site.additional_domains)) then
    return 'domain_mismatch';
  end if;

  -- Einstellungen der Website respektieren -----------------------------------
  if v_site.respect_gpc_dnt and coalesce((p ->> 'gpc')::boolean, false) then
    return 'ignored';
  end if;
  if v_site.tracking_mode = 'consent_required' and not coalesce((p ->> 'consent')::boolean, false) then
    return 'ignored';
  end if;
  if (v_type = 'outbound_click' and not v_site.track_outbound_clicks)
     or (v_type = 'download' and not v_site.track_downloads)
     or (v_type in ('phone_click', 'email_click') and not v_site.track_contact_clicks)
     or (v_type in ('form_start', 'form_submit') and not v_site.track_form_interactions)
     or (v_type = 'scroll' and not v_site.track_scroll_depth) then
    return 'ignored';
  end if;
  if exists (select 1 from unnest(v_site.excluded_paths) x where v_path like x || '%') then
    return 'ignored';
  end if;

  -- Besucher-Hash (täglicher Salt, IP wird nicht gespeichert) -----------------
  select salt into v_salt from analytics.daily_salts where day = current_date;
  if v_salt is null then
    insert into analytics.daily_salts (day, salt)
    values (current_date, extensions.gen_random_bytes(32))
    on conflict (day) do nothing;
    select salt into v_salt from analytics.daily_salts where day = current_date;
  end if;
  v_hash := substring(extensions.digest(
    v_salt || convert_to(v_site.id::text || '|' || (p ->> 'ip') || '|' || coalesce(p ->> 'user_agent', ''), 'UTF8'),
    'sha256') from 1 for 16);

  -- Heartbeat: hält eine laufende Session aktiv (Echtzeit), speichert kein Event ---
  if v_type = 'heartbeat' then
    update analytics.analytics_sessions
    set last_activity_at = v_now
    where website_id = v_site.id and visitor_hash = v_hash and closed_at is null
      and started_at > v_now - interval '1 day'
      and last_activity_at > v_now - make_interval(mins => v_site.session_timeout_minutes);
    return case when found then 'ok' else 'ignored' end;
  end if;

  -- Session finden oder anlegen -------------------------------------------------
  select id, started_at, utm_campaign, utm_source into v_session
  from analytics.analytics_sessions
  where website_id = v_site.id and visitor_hash = v_hash and closed_at is null
    and last_activity_at > v_now - make_interval(mins => v_site.session_timeout_minutes)
  order by last_activity_at desc
  limit 1
  for update;

  v_new_campaign := found and (
    (p ->> 'utm_campaign' is not null and p ->> 'utm_campaign' is distinct from v_session.utm_campaign)
    or (p ->> 'utm_source' is not null and p ->> 'utm_source' is distinct from v_session.utm_source));

  if not found or v_new_campaign then
    if v_type = 'engagement' then
      return 'ignored';  -- Engagement ohne laufende Session ist bedeutungslos
    end if;
    v_session_id := gen_random_uuid();
    v_started := v_now;
    insert into analytics.analytics_sessions (
      id, started_at, last_activity_at, website_id, organization_id, visitor_hash, visitor_id_type,
      entry_path, exit_path, channel, referrer_host,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      country_code, region_code, city, device_type, browser, os)
    values (
      v_session_id, v_started, v_now, v_site.id, v_site.organization_id, v_hash, 'daily_hash',
      v_path, v_path, coalesce((p ->> 'channel')::analytics.traffic_channel, 'unassigned'), p ->> 'referrer_host',
      p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign', p ->> 'utm_content', p ->> 'utm_term',
      p ->> 'country_code',
      case when v_site.geo_granularity in ('region', 'city') then p ->> 'region_code' end,
      case when v_site.geo_granularity = 'city' then p ->> 'city' end,
      p ->> 'device_type', p ->> 'browser', p ->> 'os');
  else
    v_session_id := v_session.id;
    v_started := v_session.started_at;
  end if;

  update analytics.analytics_sessions
  set last_activity_at = v_now,
      exit_path = case when v_type = 'pageview' then v_path else exit_path end,
      pageviews = pageviews + (v_type = 'pageview')::int,
      events = events + 1,
      engagement_ms = engagement_ms + v_engage
  where id = v_session_id and started_at = v_started;

  -- Event speichern ---------------------------------------------------------------
  insert into analytics.analytics_events (
    occurred_at, received_at, website_id, organization_id, session_id, visitor_hash, visitor_id_type,
    event_type, event_name, hostname, pathname, referrer_host, referrer_path, channel,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id_type,
    country_code, region_code, city, device_type, browser, os, engagement_ms, scroll_depth, props)
  values (
    v_now, v_now, v_site.id, v_site.organization_id, v_session_id, v_hash, 'daily_hash',
    v_type, v_name, v_host, v_path, p ->> 'referrer_host', p ->> 'referrer_path',
    coalesce((p ->> 'channel')::analytics.traffic_channel, 'unassigned'),
    p ->> 'utm_source', p ->> 'utm_medium', p ->> 'utm_campaign', p ->> 'utm_content', p ->> 'utm_term',
    p ->> 'click_id_type',
    p ->> 'country_code',
    case when v_site.geo_granularity in ('region', 'city') then p ->> 'region_code' end,
    case when v_site.geo_granularity = 'city' then p ->> 'city' end,
    p ->> 'device_type', p ->> 'browser', p ->> 'os',
    nullif(v_engage, 0),
    case when v_type = 'scroll' then least(greatest((p ->> 'scroll_depth')::smallint, 0), 100) end,
    v_props);

  -- Register der Custom-Event-Namen (max. 500 je Website) -------------------------
  if v_type = 'custom' then
    update analytics.custom_events set last_seen_at = v_now
    where website_id = v_site.id and event_name = v_name;
    if not found and (select count(*) from analytics.custom_events where website_id = v_site.id) < 500 then
      insert into analytics.custom_events (website_id, event_name) values (v_site.id, v_name)
      on conflict do nothing;
    end if;
  end if;

  return 'ok';
end $$;

-- =============================================================================
-- Rechte
-- =============================================================================
revoke all on all tables in schema core from public, anon, authenticated;
revoke all on all functions in schema core from public, anon, authenticated;

grant select on core.tenants, core.tenant_branding, core.tenant_members, core.invitations, core.audit_logs
  to authenticated;
grant update (name) on core.tenants to authenticated;
grant insert, update, delete on core.tenant_branding to authenticated;
grant update (role), delete on core.tenant_members to authenticated;
grant delete on core.invitations to authenticated;

grant all on all tables in schema core to service_role;
grant usage on all sequences in schema core to service_role;
-- Audit-Log ist append-only, auch für service_role
revoke update, delete, truncate on core.audit_logs from service_role;

grant execute on function core.has_tenant_role(uuid, core.member_role) to authenticated, service_role;
grant execute on function core.create_tenant(text, text) to authenticated;
grant execute on function core.create_invitation(uuid, text, core.member_role) to authenticated;
grant execute on function core.get_invitation(text) to authenticated;
grant execute on function core.accept_invitation(text) to authenticated;
grant execute on function core.list_members(uuid) to authenticated;
