-- =============================================================================
-- NOVA Projekte – Vorlagen und Kopieren (Plattform-Phase 2b-3)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- A: a Owner, d Mitglied · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@tpl.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@tpl.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@tpl.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'tpl-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'tpl-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

-- Quellprojekt in einer früheren Transaktion (Protokoll unterscheidet „neu angelegt“ über now())
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
insert into projects.projects (id, tenant_id, name, start_date, due_date, budget_hours) values
  ('90000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Website Kunde X', '2026-01-05', '2026-02-27', 80);
insert into projects.statuses (tenant_id, project_id, name, category, position) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Freigabe Kunde', 'in_progress', 5);
insert into projects.milestones (id, tenant_id, project_id, name, due_date) values
  ('92000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Go-live', '2026-02-27');
insert into projects.tasks (id, tenant_id, project_id, title, status_id, start_date, due_date, milestone_id, assignee_member_id, estimate_minutes) values
  ('91000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Konzept',
   (select id from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001' and name = 'Erledigt'),
   '2026-01-05', '2026-01-09', null, 'd1000000-0000-4000-8000-00000000000d', 240),
  ('91000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Umsetzung',
   (select id from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001' and name = 'Freigabe Kunde'),
   '2026-01-12', '2026-02-20', '92000000-0000-4000-8000-000000000001', null, null);
insert into projects.tasks (id, tenant_id, project_id, parent_id, title, status_id) values
  ('91000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000002', 'Startseite',
   (select id from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001' and name = 'Offen'));
insert into projects.checklist_items (tenant_id, project_id, task_id, title, done) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'Logo', true);
insert into projects.task_dependencies (tenant_id, project_id, task_id, depends_on_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001');
insert into projects.comments (tenant_id, project_id, task_id, body) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Nicht kopieren');

-- Vorlage aus dem Projekt
create temp table ids (template uuid, copy uuid);
grant all on ids to authenticated;
insert into ids (template) select projects.copy_project('90000000-0000-4000-8000-000000000001', 'Vorlage Website', true);
select pg_temp.logout();

select is((select is_template from projects.projects where id = (select template from ids)), true, 'Vorlage ist markiert');
select is((select array_agg(name order by position) from projects.statuses where project_id = (select template from ids)),
  array['Offen', 'In Arbeit', 'Prüfung', 'Erledigt', 'Freigabe Kunde'], 'Status werden übernommen, keine doppelten');
select is((select count(*)::int from projects.tasks where project_id = (select template from ids)), 3, 'Aufgaben samt Unteraufgaben');
select is((select count(*)::int from projects.tasks where project_id = (select template from ids) and completed_at is not null), 0,
  'Erledigte Aufgaben starten offen');
select is((select count(*)::int from projects.tasks where project_id = (select template from ids) and assignee_member_id is not null), 0,
  'Keine Zuständigkeiten');
select is((select count(*)::int from projects.comments where project_id = (select template from ids)), 0, 'Keine Kommentare');
select is((select count(*)::int from projects.checklist_items where project_id = (select template from ids) and not done), 1,
  'Checkliste offen übernommen');
select is((select count(*)::int from projects.task_dependencies where project_id = (select template from ids)), 1, 'Abhängigkeit übernommen');
select is((select t.title from projects.tasks t join projects.tasks p on p.id = t.parent_id where t.project_id = (select template from ids)),
  'Startseite', 'Unteraufgabe hängt an der kopierten Hauptaufgabe');
select is((select count(*)::int from core.search_index where entity_id = (select template from ids)), 0, 'Vorlagen stehen nicht in der Suche');

-- Projekt aus Vorlage mit neuem Start: Termine verschieben sich
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update ids set copy = projects.copy_project((select template from ids), 'Website Kunde Y', false, '2026-03-02');
select pg_temp.logout();
select is((select array[start_date, due_date] from projects.projects where id = (select copy from ids)),
  array['2026-03-02'::date, '2026-04-24'::date], 'Projektzeitraum verschoben');
select is((select due_date from projects.tasks where project_id = (select copy from ids) and title = 'Umsetzung'), '2026-04-17'::date,
  'Aufgabentermine verschoben');
select is((select m.due_date from projects.milestones m where m.project_id = (select copy from ids)), '2026-04-24'::date, 'Meilenstein verschoben');
select is((select ms.name from projects.tasks t join projects.milestones ms on ms.id = t.milestone_id
           where t.project_id = (select copy from ids)), 'Go-live', 'Meilenstein-Zuordnung bleibt');
select is((select pm.role from projects.project_members pm join core.tenant_members m on m.id = pm.member_id
           where pm.project_id = (select copy from ids) and m.user_id = 'd0000000-0000-0000-0000-00000000000d'), 'manager',
  'Wer kopiert, leitet das neue Projekt');
select is((select count(*)::int from core.audit_logs where (metadata ->> 'project_id')::uuid = (select copy from ids)), 0,
  'Kopierte Inhalte füllen das Protokoll nicht');
select is((select count(*)::int from core.audit_logs where target_id = (select copy from ids)::text), 1, 'ein Eintrag für das neue Projekt');

-- Rechte
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select throws_ok($$select projects.copy_project('90000000-0000-4000-8000-000000000001', 'Heimliche Vorlage', true)$$, '42501', null,
  'Vorlagen nur mit projects.manage');
select throws_ok($$insert into projects.time_entries (tenant_id, project_id, started_at, ended_at)
  select '11111111-0000-4000-8000-00000000000a', template, now() - interval '1 hour', now() from ids$$, '42501', null,
  'Keine Zeiten auf Vorlagen');
select pg_temp.logout();
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select throws_ok($$select projects.copy_project('90000000-0000-4000-8000-000000000001', 'Fremd')$$, 'P0002', null,
  'Fremde Projekte lassen sich nicht kopieren');
select pg_temp.logout();

select * from finish();
rollback;
