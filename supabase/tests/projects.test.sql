-- =============================================================================
-- NOVA Projekte – Datenbanktests (Plattform-Phase 2b)
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

-- A: a Owner, d Mitglied, e Mitglied, c Betrachter · B: b Owner
insert into auth.users (id, email, email_confirmed_at, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@prj.example', now(), 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@prj.example', now(), 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'c@prj.example', now(), 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-00000000000d', 'd@prj.example', now(), 'authenticated', 'authenticated'),
  ('e0000000-0000-0000-0000-00000000000e', 'e@prj.example', now(), 'authenticated', 'authenticated');
insert into core.tenants (id, name, slug) values
  ('11111111-0000-4000-8000-00000000000a', 'Firma A', 'prj-a'),
  ('11111111-0000-4000-8000-00000000000b', 'Firma B', 'prj-b');
insert into core.tenant_members (id, tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d1000000-0000-4000-8000-00000000000d', '11111111-0000-4000-8000-00000000000a', 'd0000000-0000-0000-0000-00000000000d', 'member'),
  ('e1000000-0000-4000-8000-00000000000e', '11111111-0000-4000-8000-00000000000a', 'e0000000-0000-0000-0000-00000000000e', 'member'),
  ('c1000000-0000-4000-8000-00000000000c', '11111111-0000-4000-8000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'viewer'),
  ('b1000000-0000-4000-8000-00000000000b', '11111111-0000-4000-8000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'owner');

select ok(core.module_enabled('11111111-0000-4000-8000-00000000000a', 'projects'), 'Projekte sind für neue Unternehmen freigeschaltet');
select is((select count(*)::int from core.permissions where module_key = 'projects'), 5, 'Fünf Rechte im Katalog');

-- Projekt anlegen ------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$insert into projects.projects (id, tenant_id, name, number) values
  ('90000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', 'Website-Relaunch', 'EIGEN')$$,
  'Mitglied legt Projekt an');
select is((select number from projects.projects where id = '90000000-0000-4000-8000-000000000001'), 'P-00001', 'Projektnummer wird vergeben');
select is((select array_agg(name order by position) from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001'),
  array['Offen', 'In Arbeit', 'Prüfung', 'Erledigt'], 'Standardstatus werden angelegt');
select is((select role from projects.project_members where project_id = '90000000-0000-4000-8000-000000000001'
           and member_id = 'd1000000-0000-4000-8000-00000000000d'), 'manager', 'Ersteller wird Projektleitung');
select throws_ok($$insert into projects.projects (tenant_id, name, is_template) values
  ('11111111-0000-4000-8000-00000000000a', 'Vorlage', true)$$, '42501', null, 'Vorlagen nur mit projects.manage');

create temp table s as select id, name from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001';
grant select on s to authenticated;

-- Aufgaben ----------------------------------------------------------------------------
insert into projects.tasks (id, tenant_id, project_id, title, status_id, assignee_member_id, number) values
  ('91000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   'Startseite entwerfen', (select id from s where name = 'Offen'), 'e1000000-0000-4000-8000-00000000000e', 99),
  ('91000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   'Texte schreiben', (select id from s where name = 'Offen'), null, 0);
select is((select array_agg(number order by number) from projects.tasks where project_id = '90000000-0000-4000-8000-000000000001'),
  array[1, 2], 'Aufgabennummern je Projekt');
insert into projects.tasks (id, tenant_id, project_id, parent_id, title, status_id) values
  ('91000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000001', 'Farben festlegen', (select id from s where name = 'Offen'));
select throws_ok($$insert into projects.tasks (tenant_id, project_id, parent_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003',
   'Zu tief', (select id from s where name = 'Offen'))$$, '23514', null, 'Nur eine Ebene Unteraufgaben');

update projects.tasks set status_id = (select id from s where name = 'Erledigt') where id = '91000000-0000-4000-8000-000000000003';
select isnt((select completed_at from projects.tasks where id = '91000000-0000-4000-8000-000000000003'), null, 'Erledigt setzt den Zeitpunkt');
update projects.tasks set status_id = (select id from s where name = 'In Arbeit') where id = '91000000-0000-4000-8000-000000000003';
select is((select completed_at from projects.tasks where id = '91000000-0000-4000-8000-000000000003'), null, 'Wieder offen löscht ihn');
update projects.tasks set number = 77 where id = '91000000-0000-4000-8000-000000000001';
select is((select number from projects.tasks where id = '91000000-0000-4000-8000-000000000001'), 1, 'Aufgabennummer ist unveränderlich');

-- Board: verschieben
select projects.move_task('91000000-0000-4000-8000-000000000002', (select id from s where name = 'In Arbeit'));
select projects.move_task('91000000-0000-4000-8000-000000000001', (select id from s where name = 'In Arbeit'), '91000000-0000-4000-8000-000000000002');
select is((select array_agg(number order by position) from projects.tasks
           where status_id = (select id from s where name = 'In Arbeit') and parent_id is null),
  array[1, 2], 'Aufgabe vor eine andere schieben');

-- Abhängigkeiten
insert into projects.task_dependencies (tenant_id, project_id, task_id, depends_on_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001');
select throws_ok($$insert into projects.task_dependencies (tenant_id, project_id, task_id, depends_on_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001',
   '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002')$$, '23514', null, 'Kreisabhängigkeit wird verhindert');

-- Status schützen
select throws_ok($$delete from projects.statuses where id = (select id from s where name = 'In Arbeit')$$, '23503', null,
  'Status mit Aufgaben bleibt');
select throws_ok($$delete from projects.statuses where id = (select id from s where name = 'Erledigt')$$, '23514', null,
  'Letzter Erledigt-Status bleibt');
select lives_ok($$delete from projects.statuses where id = (select id from s where name = 'Prüfung')$$, 'Leerer Status lässt sich löschen');
select pg_temp.logout();

select is((select count(*)::int from core.notifications where user_id = 'e0000000-0000-0000-0000-00000000000e'
           and kind = 'projects.task.assigned'), 1, 'Zugewiesene Person wird benachrichtigt');
select is((select count(*)::int from core.search_index where entity_id = '91000000-0000-4000-8000-000000000001'), 1,
  'Aufgabe ist in der Suche');
select is((select count(*)::int from core.audit_logs where tenant_id = '11111111-0000-4000-8000-00000000000a'
           and action = 'projects.statuses.insert'), 0, 'Grundstatus füllen das Protokoll nicht');
select is((select count(*)::int from core.audit_logs where tenant_id = '11111111-0000-4000-8000-00000000000a'
           and action = 'projects.statuses.delete'), 1, 'Gelöschter Status steht im Protokoll');

-- Andere Mitglieder ---------------------------------------------------------------------
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$insert into projects.tasks (tenant_id, project_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Von e', (select id from s where name = 'Offen'))$$,
  'Mitglied arbeitet in offen sichtbaren Projekten mit');
update projects.projects set name = 'Umbenannt' where id = '90000000-0000-4000-8000-000000000001';
select is((select name from projects.projects where id = '90000000-0000-4000-8000-000000000001'), 'Website-Relaunch',
  'Projekteinstellungen nur durch Projektleitung');
insert into projects.comments (tenant_id, project_id, task_id, body) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Erster Entwurf ist fertig');
select pg_temp.logout();
select is((select count(*)::int from core.notifications where user_id = 'd0000000-0000-0000-0000-00000000000d'
           and kind = 'projects.task.commented'), 1, 'Ersteller der Aufgabe erfährt vom Kommentar');

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update projects.comments set body = 'Geändert' where task_id = '91000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select body from projects.comments where task_id = '91000000-0000-4000-8000-000000000001'), 'Erster Entwurf ist fertig',
  'Fremde Kommentare bleiben unverändert');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from projects.tasks), 4, 'Betrachter sieht Aufgaben');
select throws_ok($$insert into projects.comments (tenant_id, project_id, task_id, body) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, 'Betrachter kommentiert nicht');
select throws_ok($$insert into projects.projects (tenant_id, name) values ('11111111-0000-4000-8000-00000000000a', 'X')$$,
  '42501', null, 'Betrachter legt keine Projekte an');
select pg_temp.logout();

-- Projekt nur für Mitglieder ------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into projects.projects (id, tenant_id, name, visibility) values
  ('90000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a', 'Geheimprojekt Übernahme', 'members');
insert into projects.tasks (id, tenant_id, project_id, title, status_id) values
  ('91000000-0000-4000-8000-000000000010', '11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000002', 'Vertraulich',
   (select id from projects.statuses where project_id = '90000000-0000-4000-8000-000000000002' and category = 'todo'));
select pg_temp.logout();
select is((select count(*)::int from core.search_index where entity_id in
  ('90000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000010')), 0, 'Private Projekte stehen nicht in der Suche');

select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from projects.projects where id = '90000000-0000-4000-8000-000000000002'), 0, 'Nicht-Mitglied sieht es nicht');
select is((select count(*)::int from projects.tasks where project_id = '90000000-0000-4000-8000-000000000002'), 0, 'auch keine Aufgaben');
select throws_ok($$insert into projects.tasks (tenant_id, project_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000002', 'Rein',
   (select id from projects.statuses where project_id = '90000000-0000-4000-8000-000000000001' and category = 'todo'))$$,
  null, null, 'und legt dort nichts an');
select is(projects.can_view('90000000-0000-4000-8000-000000000002'), false, 'can_view ist falsch');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from projects.projects where id = '90000000-0000-4000-8000-000000000002'), 1, 'Owner sieht alle Projekte');
select pg_temp.logout();

-- Mitglieder verwalten
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
insert into projects.project_members (tenant_id, project_id, member_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-00000000000e');
select throws_ok($$delete from projects.project_members where project_id = '90000000-0000-4000-8000-000000000002'
  and member_id = 'd1000000-0000-4000-8000-00000000000d'$$, '23514', null, 'Letzte Projektleitung bleibt');
select pg_temp.logout();
select is((select count(*)::int from core.notifications where user_id = 'e0000000-0000-0000-0000-00000000000e'
           and kind = 'projects.member.added'), 1, 'Neues Projektmitglied wird benachrichtigt');
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from projects.tasks where project_id = '90000000-0000-4000-8000-000000000002'), 1, 'Als Mitglied sichtbar');
delete from projects.project_members where project_id = '90000000-0000-4000-8000-000000000002';
select pg_temp.logout();
select is((select count(*)::int from projects.project_members where project_id = '90000000-0000-4000-8000-000000000002'), 2,
  'Mitglied ohne Leitung ändert die Besetzung nicht');

-- Sichtbarkeit ändern entfernt Aufgaben aus der Suche
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update projects.projects set visibility = 'members' where id = '90000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select count(*)::int from core.search_index where entity_type = 'task'
           and entity_id = '91000000-0000-4000-8000-000000000001'), 0, 'Privat gestellt: Aufgaben verschwinden aus der Suche');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update projects.projects set visibility = 'tenant' where id = '90000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select count(*)::int from core.search_index where entity_type = 'task'
           and entity_id = '91000000-0000-4000-8000-000000000001'), 1, 'und kommen wieder');

-- Zeiterfassung -------------------------------------------------------------------------
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
select lives_ok($$select projects.start_timer('90000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'Entwurf')$$,
  'Stoppuhr starten');
select is((select member_id from projects.time_entries where ended_at is null), 'e1000000-0000-4000-8000-00000000000e'::uuid,
  'Zeit gehört der angemeldeten Person');
select lives_ok($$select projects.start_timer('90000000-0000-4000-8000-000000000001')$$, 'Neue Stoppuhr beendet die alte');
select is((select count(*)::int from projects.time_entries where ended_at is null), 1, 'Nur eine Stoppuhr läuft');
select isnt(projects.stop_timer('11111111-0000-4000-8000-00000000000a'), null, 'Stoppuhr anhalten');
select lives_ok($$insert into projects.time_entries (tenant_id, project_id, member_id, started_at, ended_at, note) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-00000000000d',
   '2026-11-20 08:00+01', '2026-11-20 10:30+01', 'Nachgetragen')$$, 'Zeit nachtragen');
select is((select duration_minutes from projects.time_entries where note = 'Nachgetragen'), 150, 'Dauer in Minuten');
select is((select member_id from projects.time_entries where note = 'Nachgetragen'), 'e1000000-0000-4000-8000-00000000000e'::uuid,
  'Ohne projects.time_all keine Zeiten für andere');
select throws_ok($$insert into projects.time_entries (tenant_id, project_id, started_at, ended_at) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', '2026-11-20 08:00+01', '2026-11-21 10:30+01')$$,
  '23514', null, 'Höchstens 24 Stunden je Eintrag');
select pg_temp.logout();

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select lives_ok($$select projects.start_timer('90000000-0000-4000-8000-000000000001')$$, 'Zweite Person, eigene Stoppuhr');
select is((select count(*)::int from projects.time_entries), 1, 'Mitglied sieht nur eigene Zeiten');
update projects.time_entries set note = 'manipuliert' where note = 'Nachgetragen';
select pg_temp.logout();
select is((select count(*)::int from projects.time_entries where note = 'manipuliert'), 0, 'Fremde Zeiten bleiben unverändert');

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from projects.time_entries), 4, 'projects.time_all sieht alle Zeiten');
update projects.time_entries set note = 'Korrigiert' where note = 'Nachgetragen';
select pg_temp.logout();
select is((select count(*)::int from core.audit_logs where action = 'projects.time_entries.update'
           and tenant_id = '11111111-0000-4000-8000-00000000000a'), 1, 'Korrekturen durch andere werden protokolliert');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select throws_ok($$select projects.start_timer('90000000-0000-4000-8000-000000000001')$$, '42501', null,
  'Betrachter erfasst keine Zeiten');
select pg_temp.logout();

-- Fremdes Unternehmen ----------------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from projects.projects), 0, 'Fremde Projekte unsichtbar');
select is((select count(*)::int from projects.time_entries), 0, 'Fremde Zeiten unsichtbar');
select throws_ok($$insert into projects.tasks (tenant_id, project_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Fremd', (select id from s where name = 'Offen'))$$,
  '42501', null, 'Keine Aufgaben in fremden Projekten');
insert into projects.projects (id, tenant_id, name) values
  ('90000000-0000-4000-8000-0000000000b1', '11111111-0000-4000-8000-00000000000b', 'Projekt B');
select throws_ok($$insert into projects.tasks (tenant_id, project_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-0000000000b1', 'Trick', (select id from s where name = 'Offen'))$$,
  '23503', null, 'Status eines fremden Projekts lässt sich nicht unterschieben');
select pg_temp.logout();

-- Archivierte Projekte sind schreibgeschützt ---------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
update projects.projects set archived_at = now() where id = '90000000-0000-4000-8000-000000000001';
select throws_ok($$insert into projects.tasks (tenant_id, project_id, title, status_id) values
  ('11111111-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'Zu spät', (select id from s where name = 'Offen'))$$,
  '42501', null, 'Keine neuen Aufgaben im Archiv');
update projects.projects set archived_at = null where id = '90000000-0000-4000-8000-000000000001';
select pg_temp.logout();

-- Erinnerungen ------------------------------------------------------------------------------
update projects.tasks set due_date = current_date - 1 where id = '91000000-0000-4000-8000-000000000002';
select is(projects.send_reminders(), 1, 'Fällige Aufgabe wird gemeldet');
select is(projects.send_reminders(), 0, 'nur einmal');
select is((select count(*)::int from core.notifications where kind = 'projects.task.due'
           and user_id = 'd0000000-0000-0000-0000-00000000000d'), 1, 'an die Erstellerin, wenn niemand zuständig ist');

-- Austritt der einzigen Projektleitung blockiert das Entfernen aus dem Unternehmen nicht ----
select lives_ok($$delete from core.tenant_members where id = 'd1000000-0000-4000-8000-00000000000d'$$,
  'Person verlässt das Unternehmen trotz Projektleitung');
select is((select count(*)::int from projects.time_entries where member_id is null), 1, 'Ihre Zeiten bleiben erhalten');

-- Löschen nur mit projects.manage -------------------------------------------------------------
select pg_temp.login('e0000000-0000-0000-0000-00000000000e');
delete from projects.projects where id = '90000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select count(*)::int from projects.projects where id = '90000000-0000-4000-8000-000000000001'), 1, 'Mitglied löscht kein Projekt');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select lives_ok($$delete from projects.projects where id = '90000000-0000-4000-8000-000000000001'$$, 'Owner löscht Projekt samt Inhalt');
select pg_temp.logout();
select is((select count(*)::int from core.search_index where entity_type in ('project', 'task')
           and tenant_id = '11111111-0000-4000-8000-00000000000a'), 0, 'Suche ist bereinigt');

select * from finish();
rollback;
