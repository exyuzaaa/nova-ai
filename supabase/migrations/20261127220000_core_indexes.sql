-- =============================================================================
-- NOVA CORE – Indizes und Policies nach den Supabase-Performance-Hinweisen
-- (Plattform-Phase 1c)
-- -----------------------------------------------------------------------------
-- 1. Jeder Fremdschlüssel erhält einen passenden Index (schnelle Löschkaskaden,
--    schnelle Abfragen je Unternehmen). Einzelindizes, die von den neuen
--    zusammengesetzten Indizes abgedeckt werden, entfallen.
-- 2. „for all“-Policies werden in insert/update/delete aufgeteilt, damit beim Lesen
--    nur noch eine Policy ausgewertet wird.
-- =============================================================================

-- Zusammengesetzte Fremdschlüssel (tenant_id, …)
create index member_roles_tenant_member_idx on core.member_roles (tenant_id, member_id);
create index member_roles_tenant_role_idx on core.member_roles (tenant_id, role_id);
create index role_permissions_tenant_role_idx on core.role_permissions (tenant_id, role_id);
create index role_permissions_permission_idx on core.role_permissions (permission_key);
create index team_members_tenant_team_idx on core.team_members (tenant_id, team_id);
create index team_members_tenant_member_idx on core.team_members (tenant_id, member_id);
create index departments_tenant_parent_idx on core.departments (tenant_id, parent_id);
create index departments_tenant_lead_idx on core.departments (tenant_id, lead_member_id);
create index teams_tenant_department_idx on core.teams (tenant_id, department_id);
create index teams_tenant_lead_idx on core.teams (tenant_id, lead_member_id);
create index tenant_modules_module_idx on core.tenant_modules (module_key);

-- Verweise auf Nutzer (Löschen eines Kontos)
create index roles_created_by_idx on core.roles (created_by);
create index member_roles_created_by_idx on core.member_roles (created_by);
create index tenant_members_invited_by_idx on core.tenant_members (invited_by);
create index tenant_modules_changed_by_idx on core.tenant_modules (changed_by);
create index invitations_invited_by_idx on core.invitations (invited_by);
create index invitations_accepted_by_idx on core.invitations (accepted_by);

-- Durch die zusammengesetzten Indizes abgedeckt
drop index core.role_permissions_tenant_idx;
drop index core.member_roles_tenant_idx;
drop index core.team_members_tenant_idx;
drop index core.departments_parent_idx;
drop index core.teams_department_idx;

-- Policies aufteilen ---------------------------------------------------------------
drop policy departments_write on core.departments;
create policy departments_insert on core.departments for insert to authenticated
  with check (core.can(tenant_id, 'core.departments.manage'));
create policy departments_update on core.departments for update to authenticated
  using (core.can(tenant_id, 'core.departments.manage')) with check (core.can(tenant_id, 'core.departments.manage'));
create policy departments_delete on core.departments for delete to authenticated
  using (core.can(tenant_id, 'core.departments.manage'));

drop policy teams_write on core.teams;
create policy teams_insert on core.teams for insert to authenticated
  with check (core.can(tenant_id, 'core.departments.manage'));
create policy teams_update on core.teams for update to authenticated
  using (core.can(tenant_id, 'core.departments.manage')) with check (core.can(tenant_id, 'core.departments.manage'));
create policy teams_delete on core.teams for delete to authenticated
  using (core.can(tenant_id, 'core.departments.manage'));

drop policy team_members_write on core.team_members;
create policy team_members_insert on core.team_members for insert to authenticated
  with check (core.can(tenant_id, 'core.departments.manage'));
create policy team_members_delete on core.team_members for delete to authenticated
  using (core.can(tenant_id, 'core.departments.manage'));
revoke update on core.team_members from authenticated;

drop policy tenant_branding_write on core.tenant_branding;
create policy tenant_branding_insert on core.tenant_branding for insert to authenticated
  with check (core.can(tenant_id, 'core.settings.manage'));
create policy tenant_branding_update on core.tenant_branding for update to authenticated
  using (core.can(tenant_id, 'core.settings.manage')) with check (core.can(tenant_id, 'core.settings.manage'));
create policy tenant_branding_delete on core.tenant_branding for delete to authenticated
  using (core.can(tenant_id, 'core.settings.manage'));
