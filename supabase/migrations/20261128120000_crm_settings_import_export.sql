-- =============================================================================
-- NOVA Phase 2a-4b: CRM-Pipeline-Einstellungen, CSV-Import und -Export
--
-- * Phasen: Art (offen/gewonnen/verloren) unveränderlich; „Gewonnen“/„Verloren“
--   und die letzte offene Phase lassen sich nicht löschen. Änderungen werden
--   protokolliert.
-- * crm.create_pipeline / crm.move_stage / crm.set_default_pipeline (Invoker,
--   RLS mit crm.manage greift).
-- * crm.import_duplicates: Abgleich vieler Importzeilen mit bestehenden Kunden.
-- * crm.log_export: Export personenbezogener Daten im Protokoll festhalten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schutz der Phasen
-- -----------------------------------------------------------------------------
create or replace function crm.protect_stage()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.kind <> old.kind or new.pipeline_id <> old.pipeline_id or new.tenant_id <> old.tenant_id then
      raise exception 'Art und Pipeline einer Phase können nicht geändert werden' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Beim Löschen der ganzen Pipeline (Kaskade) gibt es nichts zu schützen
  if not exists (select 1 from crm.pipelines where id = old.pipeline_id) then
    return old;
  end if;
  if old.kind <> 'open' then
    raise exception 'Die Phasen „Gewonnen“ und „Verloren“ können nicht gelöscht werden' using errcode = '23514';
  end if;
  if not exists (select 1 from crm.pipeline_stages
                 where pipeline_id = old.pipeline_id and kind = 'open' and id <> old.id) then
    raise exception 'Eine Pipeline braucht mindestens eine offene Phase' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger pipeline_stages_protect before update or delete on crm.pipeline_stages
  for each row execute function crm.protect_stage();

-- Protokoll für Phasen: nur echte Änderungen durch Menschen. Die Grundphasen einer
-- neu angelegten Pipeline, reine Umsortierungen und das Mitlöschen beim Entfernen
-- der ganzen Pipeline würden das Protokoll nur füllen.
create or replace function crm.audit_stage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row crm.pipeline_stages := coalesce(new, old);
begin
  if tg_op = 'INSERT' and exists (select 1 from crm.pipelines where id = v_row.pipeline_id and created_at = now()) then
    return v_row;
  elsif tg_op = 'UPDATE' and new.name = old.name and new.probability = old.probability then
    return v_row;
  elsif tg_op = 'DELETE' and not exists (select 1 from crm.pipelines where id = v_row.pipeline_id) then
    return v_row;
  end if;
  perform core.log_audit(v_row.tenant_id, 'crm.pipeline_stages.' || lower(tg_op), 'pipeline_stages', v_row.id::text,
                         jsonb_build_object('name', v_row.name, 'probability', v_row.probability));
  return v_row;
end $$;

create trigger pipeline_stages_audit after insert or update or delete on crm.pipeline_stages
  for each row execute function crm.audit_stage();

-- Die Standard-Pipeline kann nicht gelöscht werden (vorher eine andere als Standard setzen)
create or replace function crm.protect_default_pipeline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.is_default and exists (select 1 from core.tenants where id = old.tenant_id) then
    raise exception 'Die Standard-Pipeline kann nicht gelöscht werden' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger pipelines_protect_default before delete on crm.pipelines
  for each row execute function crm.protect_default_pipeline();

-- -----------------------------------------------------------------------------
-- Pipeline anlegen (mit Grundphasen), Phasen sortieren, Standard festlegen
-- -----------------------------------------------------------------------------
create or replace function crm.create_pipeline(p_tenant uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_pipeline uuid;
begin
  insert into crm.pipelines (tenant_id, name, position)
  values (p_tenant, btrim(p_name),
          coalesce((select max(position) + 1 from crm.pipelines where tenant_id = p_tenant), 1))
  returning id into v_pipeline;
  insert into crm.pipeline_stages (tenant_id, pipeline_id, name, position, probability, kind) values
    (p_tenant, v_pipeline, 'Neu', 1, 10, 'open'),
    (p_tenant, v_pipeline, 'Angebot', 2, 50, 'open'),
    (p_tenant, v_pipeline, 'Gewonnen', 3, 100, 'won'),
    (p_tenant, v_pipeline, 'Verloren', 4, 0, 'lost');
  return v_pipeline;
end $$;

-- Offene Phase um eine Stelle verschieben; danach sind alle Phasen lückenlos
-- nummeriert (offene zuerst, dann Gewonnen, dann Verloren).
create or replace function crm.move_stage(p_stage uuid, p_up boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_pipeline uuid;
  v_ids      uuid[];
  v_index    integer;
  v_other    integer;
  v_swap     uuid;
begin
  select pipeline_id into v_pipeline from crm.pipeline_stages where id = p_stage and kind = 'open';
  if not found then
    raise exception 'Phase nicht gefunden' using errcode = 'P0002';
  end if;

  select array_agg(id order by case kind when 'open' then 0 when 'won' then 1 else 2 end, position, created_at, id)
  into v_ids from crm.pipeline_stages where pipeline_id = v_pipeline;

  v_index := array_position(v_ids, p_stage);
  v_other := v_index + case when p_up then -1 else 1 end;
  if v_other >= 1 and v_other <= array_length(v_ids, 1)
     and (select kind from crm.pipeline_stages where id = v_ids[v_other]) = 'open' then
    v_swap := v_ids[v_other];
    v_ids[v_other] := p_stage;
    v_ids[v_index] := v_swap;
  end if;

  update crm.pipeline_stages s set position = o.ordinality
  from unnest(v_ids) with ordinality as o(id, ordinality)
  where s.id = o.id and s.position is distinct from o.ordinality::integer;
end $$;

create or replace function crm.set_default_pipeline(p_pipeline uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from crm.pipelines where id = p_pipeline;
  if not found then
    raise exception 'Pipeline nicht gefunden' using errcode = 'P0002';
  end if;
  update crm.pipelines set is_default = false where tenant_id = v_tenant and is_default and id <> p_pipeline;
  update crm.pipelines set is_default = true where id = p_pipeline and not is_default;
  if not found and not exists (select 1 from crm.pipelines where id = p_pipeline and is_default) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Import: Dubletten für viele Zeilen auf einmal finden (gleicher Name oder
-- gleiche E-Mail-Adresse, ohne Groß-/Kleinschreibung; archivierte ausgenommen)
-- -----------------------------------------------------------------------------
create or replace function crm.import_duplicates(p_tenant uuid, p_rows jsonb)
returns table (row_index integer, customer_id uuid, number text, name text)
language sql stable security invoker set search_path = '' as $$
  select r.ordinality::integer - 1, c.id, c.number, c.name
  from jsonb_array_elements(p_rows) with ordinality as r(value, ordinality)
  join crm.customers c
    on c.tenant_id = p_tenant
   and c.archived_at is null
   and (lower(btrim(c.name)) = lower(btrim(r.value ->> 'name'))
        or (nullif(btrim(r.value ->> 'email'), '') is not null
            and lower(c.email) = lower(btrim(r.value ->> 'email'))))
  where jsonb_typeof(p_rows) = 'array' and jsonb_array_length(p_rows) <= 5000
  order by 1, c.number;
$$;

-- -----------------------------------------------------------------------------
-- Export protokollieren (DSGVO: wer hat wann welche Daten heruntergeladen)
-- -----------------------------------------------------------------------------
create or replace function crm.log_export(p_tenant uuid, p_kind text, p_rows integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not core.can(p_tenant, 'crm.export') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_kind not in ('customers', 'leads') then
    raise exception 'Unbekannter Export' using errcode = '22023';
  end if;
  perform core.log_audit(p_tenant, 'crm.export', p_kind, null,
                         jsonb_build_object('kind', p_kind, 'rows', greatest(coalesce(p_rows, 0), 0)));
end $$;

-- Ausdrücklich: Nur angemeldete Nutzer dürfen die Funktionen aufrufen
revoke all on function crm.create_pipeline(uuid, text), crm.move_stage(uuid, boolean),
  crm.set_default_pipeline(uuid), crm.import_duplicates(uuid, jsonb), crm.log_export(uuid, text, integer),
  crm.protect_stage(), crm.protect_default_pipeline(), crm.audit_stage() from public, anon;
grant execute on function crm.create_pipeline(uuid, text), crm.move_stage(uuid, boolean),
  crm.set_default_pipeline(uuid), crm.import_duplicates(uuid, jsonb), crm.log_export(uuid, text, integer)
  to authenticated;
