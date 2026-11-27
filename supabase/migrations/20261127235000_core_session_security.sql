-- =============================================================================
-- NOVA CORE – Sitzungen und Zwei-Faktor-Anmeldung (Plattform-Phase 1d)
-- -----------------------------------------------------------------------------
-- 1. core.session_ok(): Jede Rechteprüfung (has_tenant_role, can, Analytics)
--    verlangt zusätzlich
--      a) eine noch gültige Sitzung: Wird eine Sitzung beendet, verliert auch ein noch
--         nicht abgelaufener Zugriffstoken sofort den Zugriff auf Unternehmensdaten;
--      b) bei eingerichtetem zweitem Faktor eine Sitzung mit Faktor (aal2). Ein
--         gestohlenes Passwort allein öffnet keine Unternehmensdaten.
-- 2. core.my_sessions() / core.revoke_session(): eigene Sitzungen ansehen und
--    gezielt beenden (Geräteverwaltung).
-- =============================================================================

create or replace function core.session_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (
      nullif(auth.jwt() ->> 'session_id', '') is null
      or exists (
        select 1 from auth.sessions s
        where s.id = (auth.jwt() ->> 'session_id')::uuid
          and (s.not_after is null or s.not_after > now())
      )
    )
    and (
      coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      )
    );
$$;

-- Bestehende Prüfungen um die Sitzungsprüfung ergänzen ------------------------------
create or replace function core.has_tenant_role(p_tenant uuid, p_min core.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select core.session_ok() and exists (
    select 1 from core.tenant_members m
    join core.tenants t on t.id = m.tenant_id and t.deleted_at is null
    where m.tenant_id = p_tenant
      and m.user_id = (select auth.uid())
      and m.role >= p_min
  );
$$;

create or replace function core.can(p_tenant uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select core.session_ok() and exists (
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
    and core.session_ok()
    and core.module_enabled(w.organization_id, 'analytics')
    and (
      m.role >= 'admin'
      or not exists (select 1 from analytics.organization_member_websites r where r.member_id = m.id)
      or exists (select 1 from analytics.organization_member_websites r
                 where r.member_id = m.id and r.website_id = w.id)
    );
$$;

-- Unternehmensliste: Mitgliedschaften sind nur mit gültiger Sitzung sichtbar
drop policy tenant_members_select on core.tenant_members;
create policy tenant_members_select on core.tenant_members for select to authenticated
  using (core.has_tenant_role(tenant_id, 'viewer'));

-- Geräteverwaltung -----------------------------------------------------------------
create or replace function core.my_sessions()
returns table (
  id           uuid,
  created_at   timestamptz,
  last_seen_at timestamptz,
  user_agent   text,
  ip           text,
  aal          text,
  is_current   boolean
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at,
         greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC'),
         left(s.user_agent, 500), host(s.ip), s.aal::text,
         s.id::text = (auth.jwt() ->> 'session_id')
  from auth.sessions s
  where s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
  order by s.id::text = (auth.jwt() ->> 'session_id') desc,
           greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') desc
  limit 50;
$$;

-- Eine eigene Sitzung beenden (nicht die aktuelle – dafür gibt es „Abmelden“).
create or replace function core.revoke_session(p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not core.session_ok() then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if p_session::text = (auth.jwt() ->> 'session_id') then
    raise exception 'Die aktuelle Sitzung wird über „Abmelden“ beendet' using errcode = '22023';
  end if;
  delete from auth.sessions where id = p_session and user_id = v_uid;
  if not found then
    return false;
  end if;
  perform core.log_audit(null, 'auth.session.revoked', 'session', p_session::text, '{}');
  return true;
end $$;

-- Hat die Person einen bestätigten zweiten Faktor? (für die Oberfläche)
create or replace function core.my_mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;

revoke all on function core.session_ok() from public, anon;
revoke all on function core.my_sessions() from public, anon;
revoke all on function core.revoke_session(uuid) from public, anon;
revoke all on function core.my_mfa_required() from public, anon;
grant execute on function core.session_ok() to authenticated, service_role;
grant execute on function core.my_sessions() to authenticated;
grant execute on function core.revoke_session(uuid) to authenticated;
grant execute on function core.my_mfa_required() to authenticated;
