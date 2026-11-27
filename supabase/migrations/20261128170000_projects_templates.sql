-- =============================================================================
-- NOVA Projekte – Vorlagen und Kopieren (Plattform-Phase 2b-3)
--
-- * projects.copy_project: Projekt oder Vorlage kopieren (Status, Meilensteine,
--   Aufgaben mit Unteraufgaben, Checklisten, Abhängigkeiten). Termine werden um
--   den Abstand zum neuen Startdatum verschoben. Kommentare, Zeiten und
--   Zuständigkeiten werden nicht übernommen; erledigte Aufgaben starten offen.
--   SECURITY INVOKER: Lesen der Quelle und Anlegen prüft RLS (Vorlagen nur mit
--   projects.manage).
-- * Kopierte Inhalte füllen das Protokoll nicht (ein Eintrag für das Projekt).
-- * Keine Zeiterfassung auf Vorlagen.
-- =============================================================================

create or replace function projects.copy_project(p_source uuid, p_name text, p_template boolean default false, p_start date default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_src      projects.projects;
  v_new      uuid;
  v_offset   integer := 0;
  v_status   jsonb := '{}';
  v_mile     jsonb := '{}';
  v_task     jsonb := '{}';
  v_first    uuid;
  v_row      record;
  v_id       uuid;
begin
  select * into v_src from projects.projects where id = p_source;
  if not found then
    raise exception 'Projekt nicht gefunden' using errcode = 'P0002';
  end if;
  if p_start is not null and v_src.start_date is not null then
    v_offset := p_start - v_src.start_date;
  end if;

  insert into projects.projects (tenant_id, name, description, customer_id, status, visibility, color,
                                 start_date, due_date, budget_hours, is_template)
  values (v_src.tenant_id, btrim(p_name), v_src.description, v_src.customer_id,
          case when p_template then 'planned' else 'active' end, v_src.visibility, v_src.color,
          coalesce(p_start, v_src.start_date + v_offset), v_src.due_date + v_offset, v_src.budget_hours, p_template)
  returning id into v_new;
  perform set_config('projects.copying', v_new::text, true);

  -- Status übernehmen, danach die Standardstatus des neuen Projekts entfernen
  for v_row in select * from projects.statuses where project_id = p_source order by position, created_at loop
    insert into projects.statuses (tenant_id, project_id, name, category, position)
    values (v_src.tenant_id, v_new, v_row.name, v_row.category, v_row.position)
    returning id into v_id;
    v_status := v_status || jsonb_build_object(v_row.id::text, v_id::text);
    if v_first is null and v_row.category = 'todo' then
      v_first := v_id;
    end if;
  end loop;
  delete from projects.statuses s
  where s.project_id = v_new
    and not exists (select 1 from jsonb_each_text(v_status) m where m.value::uuid = s.id);

  for v_row in select * from projects.milestones where project_id = p_source loop
    insert into projects.milestones (tenant_id, project_id, name, description, due_date)
    values (v_src.tenant_id, v_new, v_row.name, v_row.description, v_row.due_date + v_offset)
    returning id into v_id;
    v_mile := v_mile || jsonb_build_object(v_row.id::text, v_id::text);
  end loop;

  -- Hauptaufgaben vor Unteraufgaben; erledigte Aufgaben beginnen im ersten offenen Status
  for v_row in
    select t.*, s.category from projects.tasks t join projects.statuses s on s.id = t.status_id
    where t.project_id = p_source order by (t.parent_id is not null), t.number
  loop
    insert into projects.tasks (tenant_id, project_id, parent_id, title, description, status_id, priority,
                                start_date, due_date, estimate_minutes, milestone_id, position)
    values (v_src.tenant_id, v_new, (v_task ->> v_row.parent_id::text)::uuid, v_row.title, v_row.description,
            case when v_row.category = 'done' then v_first else (v_status ->> v_row.status_id::text)::uuid end,
            v_row.priority, v_row.start_date + v_offset, v_row.due_date + v_offset, v_row.estimate_minutes,
            (v_mile ->> v_row.milestone_id::text)::uuid, v_row.position)
    returning id into v_id;
    v_task := v_task || jsonb_build_object(v_row.id::text, v_id::text);
  end loop;

  insert into projects.checklist_items (tenant_id, project_id, task_id, title, done, position)
  select v_src.tenant_id, v_new, (v_task ->> c.task_id::text)::uuid, c.title, false, c.position
  from projects.checklist_items c where c.project_id = p_source;

  insert into projects.task_dependencies (tenant_id, project_id, task_id, depends_on_id)
  select v_src.tenant_id, v_new, (v_task ->> d.task_id::text)::uuid, (v_task ->> d.depends_on_id::text)::uuid
  from projects.task_dependencies d where d.project_id = p_source;

  perform set_config('projects.copying', '', true);
  return v_new;
end $$;

revoke all on function projects.copy_project(uuid, text, boolean, date) from public, anon;
grant execute on function projects.copy_project(uuid, text, boolean, date) to authenticated;

-- Protokoll: Inhalte eines gerade angelegten (kopierten) Projekts nicht einzeln protokollieren
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
  -- Mitlöschen beim Entfernen eines Projekts und Inhalte neuer (kopierter) Projekte nicht protokollieren
  if tg_table_name <> 'projects' and v_row ? 'project_id' then
    if tg_op = 'DELETE' and not exists (select 1 from projects.projects where id = (v_row ->> 'project_id')::uuid) then
      return old;
    end if;
    if tg_op = 'INSERT' and tg_table_name in ('statuses', 'project_members')
       and exists (select 1 from projects.projects where id = (v_row ->> 'project_id')::uuid and created_at = now()) then
      return new;
    end if;
    -- Während projects.copy_project: Inhalte des neuen Projekts nicht einzeln protokollieren
    if v_row ->> 'project_id' = current_setting('projects.copying', true) then
      return coalesce(new, old);
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
    'is_template', v_row ->> 'is_template',
    'minutes', v_row ->> 'duration_minutes'));
  perform core.log_audit((v_row ->> 'tenant_id')::uuid, 'projects.' || tg_table_name || '.' || lower(tg_op), tg_table_name,
                         v_row ->> 'id', v_meta);
  return coalesce(new, old);
end $$;

-- Keine Zeiten auf Vorlagen
drop policy time_entries_insert on projects.time_entries;
create policy time_entries_insert on projects.time_entries for insert to authenticated
  with check (projects.can_view(project_id)
              and ((member_id = projects.my_member_id(tenant_id) and core.can(tenant_id, 'projects.time'))
                   or core.can(tenant_id, 'projects.time_all'))
              and (select archived_at is null and not is_template from projects.projects where id = project_id));
