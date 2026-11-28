# NOVA – Plattform-Architektur und Entwicklungsplan

Stand: 26.11.2026 · Grundlage: NOVA Ultimate Master Prompt (Teile 1–42) und Bestandsaufnahme des Repos `exyuzaaa/nova-ai`.

Dieses Dokument ist die Phase 0 („Bestandsaufnahme“) des Master-Prompts. Es beschreibt, was existiert, wie die fertige
Plattform aufgebaut wird, in welcher Reihenfolge gebaut wird und was für einen echten Verkauf noch fehlt.

### Freigegebene Entscheidungen (26.11.2026)

1. **Technik bleibt**: Next.js + Supabase statt NestJS/Prisma/Redis (Begründung in Abschnitt 2.1).
2. **Gemeinsamer Kern**: Die Mandanten-Tabellen ziehen von `analytics` nach `core` um (verschieben, nicht kopieren);
   die Rolle „Analyst“ heißt künftig „Mitglied“.

### Phase 1a – umgesetzt am 27.11.2026

Migration `core_tenancy`:

| Heute | Danach |
|---|---|
| `analytics.organizations` | `core.tenants` |
| `analytics.organization_members` (`organization_id`) | `core.tenant_members` (`tenant_id`) |
| `analytics.organization_invitations` | `core.invitations` |
| `analytics.organization_branding` | `core.tenant_branding` |
| `analytics.audit_logs` | `core.audit_logs` (+ `core.log_audit()` für alle Module) |
| `analytics.member_role` (viewer, analyst, admin, owner) | `core.member_role` (viewer, member, admin, owner) |
| `analytics.create_organization`, `create_invitation`, `get_invitation`, `accept_invitation`, `list_members` | gleichnamige Funktionen in `core` (`create_tenant` statt `create_organization`) |
| `analytics.has_org_role` | bleibt als Hülle um `core.has_tenant_role`, damit alle Analytics-Policies unverändert gelten |

Analytics-Tabellen behalten ihre Spalte `organization_id`; der Fremdschlüssel zeigt danach automatisch auf
`core.tenants`. Neu angelegt werden müssen nur Funktionen, deren Text die alten Tabellennamen enthält
(u. a. `analytics.accessible_website_ids`, `public.nova_ingest_event`). In derselben Migration werden die leeren
Schemas aller geplanten Module angelegt (`core`, `billing`, `platform`, `crm`, `projects`, `calendar`, `hr`,
`finance`, `documents`, `messaging`, `support`, `inventory`, `marketing`, `automation`), damit sie in Supabase
**einmalig** unter „Data API → Exposed schemas“ freigegeben werden können (lässt sich nicht per SQL setzen).

Ergebnis: Migration `20261127200000_core_tenancy.sql`, 165 Datenbanktests (davon 32 neu für den Kern), 120 Unit- und
34 Browsertests grün. Produktiv eingespielt; alle Daten erhalten (Unternehmen, Owner, Audit-Log, Website, Events,
Sitzungen). Funktionsdefinitionen in Produktion sind bis auf Kommentare identisch mit den getesteten. Im Code liegt der
Kern unter `src/modules/core` (Rollen, Validierung, `tenants.ts`, Server Actions); Analytics nutzt ihn. In der
Oberfläche heißt „Organisation“ jetzt „Unternehmen“.

### Phase 1b – umgesetzt am 27.11.2026

Migration `20261127210000_core_permissions.sql`:

- **Unternehmensprofil** in `core.tenants`: Firmierung, Anschrift, Kontakt, USt-IdNr., Branche, Größe, Sprache, Zeitzone,
  Währung, Logo-Pfad. **Sperre** (`status = suspended`) kann nur der Betreiber setzen (Spaltenrechte).
- **Module**: Katalog `core.modules` (Kern und Analytics verfügbar, alle anderen „geplant“) und Freischaltung
  `core.tenant_modules`. Neue Unternehmen erhalten Standardmodule per Trigger. `core.set_module_enabled()` schaltet
  (ab Admin, nur verfügbare Module). `core.module_entitled()` ist bis zur Abrechnung (Phase 6) immer wahr.
- **Rechte**: Katalog `core.permissions` (`modul.ressource.aktion`, Standard-Mindestrolle, vergebbar ja/nein).
  **Eigene Rollen** `core.roles` + `role_permissions` + `member_roles` geben zusätzliche Rechte. Schutz vor
  Rechteausweitung: Verwaltungsrechte des Kerns sind nicht vergebbar; vergeben darf nur, wer jedes Recht selbst hat.
- **`core.can(unternehmen, recht)`**: Mitgliedschaft + Unternehmen aktiv + Modul freigeschaltet + Recht. Grundlage
  aller neuen Policies; `core.my_permissions()` für die Oberfläche.
- **Abteilungen und Teams** (`core.departments` mit Hierarchie ohne Zyklen, `core.teams`, `core.team_members`),
  Fremdschlüssel immer über `(tenant_id, id)` – Verweise in fremde Unternehmen sind technisch unmöglich.
- **Analytics** ist jetzt ein freischaltbares Modul: abgeschaltet oder gesperrt → keine Daten, keine Erfassung.
- Tests: 229 Datenbanktests (64 neu), 125 Unit-Tests (inkl. Abgleich Rechtekatalog Code ↔ Migrationen), 34 Browsertests.
- Produktion: eingespielt, Funktionen/Policies/Spalten per Prüfsumme identisch mit dem getesteten Stand.

Offen für 1c: Performance-Hinweise der Supabase-Advisors (Indizes für zusammengesetzte Fremdschlüssel, „for all“-Policies
in Einzel-Policies aufteilen).

### Phase 1c – umgesetzt am 27.11.2026

- **Plattform-Oberfläche** unter `/app/[unternehmen]` (`src/app/(platform)`): Seitenleiste mit Unternehmenswechsel,
  Navigation (nur freigeschaltete Module mit Oberfläche und nur Bereiche, für die Rechte bestehen), mobiles Menü,
  Hinweis bei gesperrtem Unternehmen. Nach der Anmeldung landet man auf `/app` → erstes Unternehmen.
- **Tenant-Kontext** (`core/server/tenant-context.ts`): Das Kürzel in der Adresse wird nur unter den eigenen
  Unternehmen gesucht; fremde oder unbekannte Kürzel und fehlende Rechte ergeben 404.
- **Übersicht**: Kennzahlen (Mitglieder, Abteilungen, Teams), freigeschaltete Module, letzte Änderungen, Hinweis auf
  unvollständiges Profil.
- **Verwaltung**: Unternehmensprofil (mit Prüfung von USt-IdNr., E-Mail, Website), Mitglieder und Einladungen,
  Rollen und Rechte (Rechtematrix der Basisrollen, eigene Rollen, Vergabe an Mitglieder), Abteilungen (Baum) und Teams
  (Leitung, Mitglieder), Module (ein-/ausschalten, geplante Module), Protokoll (seitenweise, lesbare Einträge).
- **Analytics** verlinkt zurück zur Plattform; Mitglieder und Unternehmen werden nur noch zentral verwaltet.
- **Formulare** behalten Eingaben bei Fehlermeldungen (`useFormAction`, statt automatischem Zurücksetzen in React 19).
- **Datenbank**: Indizes für alle Fremdschlüssel des Kerns, Einzel-Policies statt „for all“
  (`20261127220000_core_indexes.sql`).
- Tests: 229 Datenbank-, 140 Unit-, 41 Browsertests (7 neue für die Verwaltung, jeweils mit axe-Prüfung).

### Phase 1d-1 – umgesetzt am 27.11.2026

Migration `20261127230000_core_notifications_search.sql`:

- **Benachrichtigungen** (`core.notifications`): entstehen nur serverseitig über `core.notify()` aus echten
  Ereignissen (Beitritt → Admins, Rollenänderung, zusätzliche Rolle, Teamzuordnung → betroffene Person, Modul
  geschaltet → Admins; nie über eigene Handlungen). Empfänger sehen nur eigene Einträge, können sie als gelesen
  markieren oder löschen. Einstellungen je Art (`core.notification_preferences`); E-Mail-Zustellung folgt mit dem
  E-Mail-Anbieter, die Wahl wird bereits gespeichert. Aufbewahrung: gelesen 90 Tage, sonst 365 Tage (pg_cron).
- **Oberfläche**: Glocke mit Zähler (Aktualisierung beim Seitenwechsel, beim Zurückkehren und jede Minute über
  `/api/core/notifications/unread`), Seite `/app/[unternehmen]/benachrichtigungen` mit Eingang und Einstellungen.
- **Globale Suche** (`core.search_index`): Trigger halten Mitglieder, Abteilungen, Teams, Rollen und Websites aktuell;
  jeder Eintrag trägt das nötige Recht, RLS filtert mit `core.can()` (auch Modulfreischaltung). Präfixsuche über alle
  Wörter, Satzzeichen trennen Wörter. Suchfeld in der Seitenleiste (Tastenkürzel „/“ und Strg/⌘+K),
  Ergebnisseite `/app/[unternehmen]/suche`. Neue Module melden ihre Datensätze über `core.search_upsert()` an.
- Tests: 256 Datenbank-, 142 Unit-, 42 Browsertests.

### Phase 1d-2 – umgesetzt am 27.11.2026

Migration `20261127235000_core_session_security.sql`:

- **`core.session_ok()`** ist Teil jeder Rechteprüfung (`has_tenant_role`, `can`, Analytics):
  - eine auf einem anderen Gerät beendete Sitzung verliert **sofort** den Zugriff auf Unternehmensdaten, auch wenn ihr
    Zugriffstoken noch nicht abgelaufen ist;
  - wer einen zweiten Faktor eingerichtet hat, sieht Unternehmensdaten nur mit bestätigter Sitzung (`aal2`) –
    ein gestohlenes Passwort allein genügt nicht, auch nicht bei direkten API-Aufrufen.
- **Zwei-Faktor-Anmeldung (TOTP)** unter `/konto/sicherheit`: Einrichten per QR-Code oder Schlüssel, Bestätigen mit
  Code, Ersatzgerät hinzufügen (Supabase bietet keine Wiederherstellungscodes), Entfernen. Nach dem Passwort fragt
  `/login/bestaetigen` den Code ab; der Proxy leitet ungeprüfte Sitzungen dorthin um.
- **Geräteverwaltung**: Liste der eigenen Sitzungen (Gerät, IP, zuletzt aktiv, mit/ohne zweiten Faktor), einzelne
  Geräte abmelden (`core.revoke_session`, protokolliert), alle anderen abmelden. Beendete Sitzungen landen auf
  `/auth/beendet` → Anmeldung mit Hinweis.
- **Sicherheitsheader** für alle Seiten: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self';
  form-action 'self'; object-src 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Startseite `/` führt jetzt zur Plattform (`/app`), Marke in Anmeldung und Titeln: „NOVA“.
- **Verschoben**: Dateiablage → Modul Dokumente (Phase 3), weil sie dort gebraucht wird und eine Virenprüfung braucht.
- Tests: 280 Datenbank-, 145 Unit-, 47 Browsertests (inkl. echter TOTP-Codes im Browsertest).

### Phase 2a-1/2 – CRM, umgesetzt am 27.11.2026

Migration `20261128090000_crm.sql` (Schema `crm`):

- **Tabellen**: Kunden (Firma/Privat, Status, Kategorie, Schlagwörter, Zuständigkeit, Archiv), Ansprechpartner (ein
  Hauptansprechpartner je Kunde), Leads (Quelle, Status, Bewertung, Wert, Wiedervorlage), Pipelines und Phasen
  (offen/gewonnen/verloren, Wahrscheinlichkeit), Verkaufschancen (Betrag, Abschlussdatum automatisch), Aktivitäten
  (Notiz, Anruf, Termin, E-Mail, Aufgabe mit Fälligkeit und Zuständigkeit).
- **Integrität**: alle Verweise über `(tenant_id, id)`; die Phase einer Verkaufschance muss zur Pipeline gehören.
- **Nummernkreise** je Unternehmen (K-, L-, V-), vom System vergeben und unveränderlich.
- **Rechte**: `crm.view` (Betrachter), `crm.edit` (Mitglied), `crm.export` (Mitglied, sensibel), `crm.manage` (Admin,
  Löschen und Pipelines). Aktivitäten nur im eigenen Namen; löschen eigene oder mit `crm.manage`.
- **Fachfunktionen**: Dublettenprüfung (`crm.find_duplicates`, ähnlicher Name per Trigramm oder gleiche E-Mail),
  Lead-Umwandlung (`crm.convert_lead`: Kunde, Hauptansprechpartner, optional Verkaufschance, Aktivitäten wandern mit).
- **Kern-Anbindung**: Suche (Kunden, Ansprechpartner, Leads, Chancen), Protokoll, Benachrichtigungen bei Zuständigkeit
  und Aufgaben, Wiedervorlagen und fällige Aufgaben alle 15 Minuten (pg_cron), Standard-Pipeline beim Einschalten.
- **Oberfläche** (`/app/[unternehmen]/crm`): Übersicht (Kennzahlen, nächste Aufgaben, neueste Kunden), Kundenliste
  (Suche, Filter, Sortierung, Seiten, Archiv), Neuer Kunde mit Dublettenwarnung, Kundendetail (Stammdaten,
  Ansprechpartner, Verlauf/Aufgaben, Verkaufschancen, Archivieren, Löschen).
- **Zeitzonen**: Fälligkeiten werden in der Zeitzone des Unternehmens eingegeben und angezeigt (`core/domain/time-zone`).
- Tests: 332 Datenbank-, 159 Unit-, 53 Browsertests.

### Phase 2a-3 – CRM-Leads, umgesetzt am 27.11.2026

- **Leadliste** (`/crm/leads`): standardmäßig offene Leads, Filter nach Status, Quelle, Zuständigkeit, Suche,
  Sortierung nach Wiedervorlage (fällige zuerst, rot markiert), Datum, Bewertung, Titel; Seiten.
- **Lead anlegen/bearbeiten**: Firma, Ansprechperson, Kontakt, Quelle, Status, Bewertung 0–100, geschätzter Wert
  (deutsche Schreibweise „1.500“ = 1.500 €), Zuständigkeit, Wiedervorlage in Ortszeit, Notizen. Umgewandelte Leads
  sind schreibgeschützt.
- **Umwandlung**: neuer Kunde (mit Hauptansprechpartner) oder Zuordnung zu einem vorgeschlagenen bestehenden Kunden
  (Dublettenprüfung, archivierte ausgenommen), optional mit Verkaufschance; Verlauf wandert zum Kunden.
- **Übersicht**: offene Leads und fällige Wiedervorlagen.
- Tests: 162 Unit-, 57 Browsertests.

---

### Phase 2a-4 – CRM-Pipeline, Import, Export, Einstellungen, umgesetzt am 27.11.2026

- **Pipeline** (`/crm/pipeline`): Kanban-Board je Pipeline, Phase per Auswahl wechseln (auch am Handy),
  Summen und gewichteter Umsatz je Phase; Verkaufschancen mit Detailseite, Verlauf und Aufgaben;
  Umsatzkarten in der CRM-Übersicht (offen, gewichtet, im Monat gewonnen).
- **CSV-Export** (`/crm/export?typ=kunden|leads`, Recht `crm.export`): Excel-tauglich (UTF-8 mit BOM, Semikolon),
  Zellen mit `= + - @` werden entschärft (Schutz vor Formel-Injection), bis 50.000 Zeilen; **jeder Export steht
  im Protokoll** (`crm.log_export`: wer, wann, wie viele Zeilen).
- **CSV-Import für Kunden** (`/crm/import`, Recht `crm.manage`): Datei bis 2 MB/2000 Zeilen, UTF-8 oder
  Windows-1252, Semikolon/Komma; Spalten werden automatisch zugeordnet und sind änderbar; Prüfung vor dem Speichern
  mit denselben Regeln wie beim manuellen Anlegen, Fehlerbericht mit Zeilennummern (auch als CSV),
  Dubletten innerhalb der Datei und gegen bestehende Kunden (`crm.import_duplicates`), wahlweise überspringen.
  Eine Exportdatei lässt sich unverändert wieder einlesen.
- **Einstellungen** (`/crm/einstellungen`, Recht `crm.manage`): Phasen umbenennen, Wahrscheinlichkeit ändern,
  ergänzen, sortieren, löschen; weitere Pipelines anlegen, Standard wechseln, leere Pipelines löschen.
  Die Datenbank schützt: „Gewonnen“/„Verloren“ und die letzte offene Phase bleiben, Phasen/Pipelines mit
  Verkaufschancen und die Standard-Pipeline sind nicht löschbar, die Art einer Phase ist unveränderlich.
  Änderungen an Phasen werden protokolliert (ohne Grundphasen und reine Umsortierungen).
- Migration `20261128120000_crm_settings_import_export.sql`, live eingespielt, Prüfsumme live = lokal.
- Tests: 363 Datenbank-, 175 Unit-, 64 Browsertests.

---

### Phase 2b-1/2 – Projekte, umgesetzt am 27.11.2026

- **Datenbank** (Schema `projects`, Migration `20261128150000_projects.sql`, live, Prüfsumme live = lokal):
  Projekte (P-00001, Status, Farbe, Zeitraum, Stundenbudget, optional CRM-Kunde), Projektteam mit Rollen
  Projektleitung/Mitglied, eigene Status je Projekt (Board-Spalten mit Art Offen/In Arbeit/Erledigt), Meilensteine,
  Aufgaben (Nummer je Projekt, eine Ebene Unteraufgaben, Priorität, Zuständigkeit, Termine, Schätzung),
  Checklisten, Abhängigkeiten (ohne Kreise), Kommentare, Zeiteinträge mit Stoppuhr (Oberfläche folgt in 2b-3).
- **Sichtbarkeit**: „Alle im Unternehmen“ oder „Nur Projektmitglieder“. Private Projekte stehen nicht in der globalen
  Suche. Archivierte Projekte sind schreibgeschützt.
- **Rechte**: `projects.view` (Betrachter), `projects.edit` und `projects.time` (Mitglied), `projects.time_all`
  (sensibel) und `projects.manage` (Admin). Projekteinstellungen ändern Projektleitung und `projects.manage`;
  löschen nur `projects.manage`. Schutzregeln in der Datenbank: letzte Projektleitung, letzter Offen-/Erledigt-Status,
  Status mit Aufgaben, Kreisabhängigkeiten, Zeiten nur für sich selbst (außer `projects.time_all`), höchstens
  eine laufende Stoppuhr je Person, max. 24 h je Eintrag. Verlässt jemand das Unternehmen, bleiben seine Zeiten.
- **Protokoll, Suche, Benachrichtigungen**: Projekte, Team, Status, Meilensteine, Aufgaben (anlegen/löschen) und
  Zeit-Korrekturen durch andere werden protokolliert; Benachrichtigungen bei Zuweisung, Kommentar, Aufnahme ins
  Projekt und fälligen Aufgaben (Fälligkeit in der Zeitzone des Unternehmens, alle 15 Minuten).
- **Oberfläche** (`/projekte`): Projektliste mit Fortschritt und Filtern, Projekt anlegen, Aufgabenliste mit
  Abhaken und Filtern, Board (Status per Auswahl wechseln, auch am Handy), Aufgabendetail mit Unteraufgaben,
  Checkliste, Abhängigkeiten, Kommentaren (eigene bearbeiten/löschen), Meilensteine, Einstellungen (Projektdaten,
  Team, Status, Archivieren/Löschen).
- Tests: 431 Datenbank-, 181 Unit-, 74 Browsertests (inkl. Barrierefreiheit und Handy-Ansicht).

---

### Phase 2b-3 – Zeiterfassung, Zeitleiste, Vorlagen, umgesetzt am 27.11.2026

- **Zeiterfassung**: Stoppuhr (je Projekt oder Aufgabe, eine laufende je Person, eine neue beendet die alte),
  Zeiten nachtragen mit Beginn und Ende oder Dauer („1:30“, „2,5“) in der Zeitzone des Unternehmens, bearbeiten,
  löschen, abrechenbar ja/nein. **Meine Zeiten** (`/projekte/zeiten`): Wochenansicht mit Summen; mit
  `projects.time_all` auch Zeiten anderer Personen. **Projektzeiten** (Reiter „Zeiten“): Monatsansicht, Summe
  abrechenbar, Gesamtzeit, Budgetverbrauch in Prozent, Auswertung nach Person und Aufgabe. Aufgaben zeigen erfasste
  gegen geschätzte Zeit.
- **Zeitleiste** (Reiter „Zeitleiste“): Hauptaufgaben mit Start/Fälligkeit als Balken, Meilensteine als Raute,
  Heute-Linie, überfällige Aufgaben markiert; als Tabelle für Screenreader lesbar.
- **Vorlagen** (`/projekte/vorlagen`, Migration `20261128170000_projects_templates.sql`, live, Prüfsumme gleich):
  Projekt als Vorlage speichern (`projects.manage`), Projekt aus Vorlage anlegen – mit neuem Startdatum werden alle
  Termine verschoben. Übernommen werden Status, Meilensteine, Aufgaben, Unteraufgaben, Checklisten (offen) und
  Abhängigkeiten; nicht übernommen: Zuständigkeiten, Kommentare, Zeiten. Vorlagen erscheinen nicht in Liste, Suche
  und Erinnerungen; auf Vorlagen lassen sich keine Zeiten buchen. Das Kopieren erzeugt einen Protokolleintrag.
- Tests: 451 Datenbank-, 184 Unit-, 80 Browsertests.

---

### Phase 2c – Kalender, umgesetzt am 28.11.2026

- **Datenbank** (Schema `calendar`, Migration `20261128190000_calendar.sql`, live in drei Teilen, Prüfsumme live = lokal):
  persönliche Kalender (je Mitglied automatisch), Teamkalender (je Team automatisch, nur Teammitglieder und
  `calendar.manage`), Unternehmenskalender (alle sehen, `calendar.manage` pflegt). Termine mit Ort, Beschreibung,
  ganztägig oder mit Uhrzeit (max. 31 Tage), Wiederholung täglich/wöchentlich (mit Wochentagen)/monatlich/jährlich,
  Intervall, Ende nach Datum oder Anzahl, einzelne Termine streichbar. Wiederholungen werden in der Zeitzone des
  Unternehmens berechnet (gleiche Uhrzeit über die Zeitumstellung; der 31. entfällt in kürzeren Monaten).
- **Einladungen**: Teilnehmende sehen den Termin auch ohne Zugriff auf den Kalender, antworten mit Zusage/Vielleicht/
  Absage; Benachrichtigungen bei Einladung, Verschiebung, Antwort und als Erinnerung (Cron alle 5 Minuten).
  Frei/Belegt (`calendar.busy`) zeigt nur Zeiten, keine Titel; der Termin zeigt „Zu dieser Zeit belegt“.
- **Datenschutz**: persönliche Termine stehen weder in der Suche noch mit Titel im Protokoll; Unternehmenstermine
  sind suchbar, Team-/Unternehmenstermine werden protokolliert.
- **iCal**: persönlicher Abo-Link (`/api/kalender/<token>`, Token nur als SHA-256-Hash gespeichert, widerrufbar,
  unbekannte Links liefern einen leeren Kalender) für Outlook, Google, Apple; einzelner Termin als `.ics`.
- **Oberfläche** (`/kalender`): Monats-, Wochen- und 30-Tage-Ansicht, neuer Termin, Termindetail mit Bearbeiten,
  Serienhinweis, Antworten, Streichen/Löschen; eigene fällige Projektaufgaben werden eingeblendet.
- Tests: 498 Datenbank-, 192 Unit-, 89 Browsertests.

---

### Phase 2d – Personal, umgesetzt am 28.11.2026

- **Datenbank** (Schema `hr`, Migration `20261128210000_hr.sql`, live in zwei Teilen, Prüfsumme live = lokal):
  Mitarbeiter (MA-00001, Position, Abteilung aus dem Kern, Vorgesetzte ohne Kreise, optional verknüpft mit einem
  NOVA-Zugang, Beschäftigungsart, Ein-/Austritt, Wochenstunden, Arbeitstage, Urlaubsanspruch), vertrauliche Daten in
  eigener Tabelle (Geburtsdatum, private Kontakte, Anschrift, IBAN mit Prüfziffer, BIC, Steuer-ID, SV-Nummer,
  Krankenkasse, Vergütung, Notfallkontakt), Abwesenheitsarten (Urlaub, Krankheit, Sonderurlaub, Fortbildung,
  Überstundenabbau; eigene Arten), Feiertage, Urlaubskorrekturen, Abwesenheiten, Onboarding-Aufgaben.
- **Rechte**: `hr.view` (Verzeichnis, Übersicht ohne Gründe), `hr.absences.request` (eigene Anträge),
  `hr.manage` (Personalverwaltung), `hr.sensitive` (vertrauliche Daten; standardmäßig nur Owner, per Rolle vergebbar).
- **Abwesenheiten**: Antrag durch die Person oder die Personalverwaltung; Arbeitstage werden nach Arbeitszeitmodell
  und Feiertagen gezählt (halbe Tage möglich); keine Überschneidungen; Genehmigung durch die direkte Führungskraft
  oder `hr.manage` (nicht für sich selbst ohne `hr.manage`); Arten ohne Genehmigung (Krankheit) gelten sofort;
  Zurückziehen vor Beginn durch die Person, danach durch Führungskraft/Personalverwaltung; Benachrichtigungen an
  Führungskraft bzw. Admins und an die Person. Krankheit ist Gesundheitsdatum: andere sehen nur „Abwesend“.
- **Urlaubskonto**: Anspruch (anteilig im Ein-/Austrittsjahr), Korrekturen, genommen, beantragt, Resturlaub.
- **Protokoll** ohne vertrauliche Inhalte (nur „Vertrauliche Daten von MA-… geändert“); Verzeichnis in der Suche.
- **Oberfläche** (`/personal`): Verzeichnis mit Suche/Abteilung/Ehemalige, Mitarbeiter anlegen, Profil mit
  Urlaubskonto, Abwesenheiten, direkten Mitarbeitenden, Onboarding, Stammdaten und vertraulichen Daten;
  Abwesenheiten (Mein Urlaub, Antrag, Meine Anträge, Zu entscheiden, Wer fehlt in 8 Wochen); Einstellungen
  (Abwesenheitsarten, Feiertage).
- Tests: 535 Datenbank-, 198 Unit-, 96 Browsertests.

---

### Phase 3a – Finanzen, umgesetzt am 28.11.2026

- **Datenbank** (Schema `finance`, Migration `20261128230000_finance.sql`, live in zwei Teilen, Prüfsumme live = lokal):
  Rechnungsdaten des Unternehmens (Firma, Anschrift, Steuernummer/USt-IdNr., Register, Geschäftsführung, Bank mit
  IBAN-Prüfung, Zahlungsziel, Angebotsgültigkeit, Standard-Steuersatz, Kleinunternehmer § 19 UStG, Fußtext),
  Artikel/Leistungen, Belege (Angebot, Rechnung, Gutschrift), Positionen, Zahlungen, Nummernkreise.
- **Rechte**: `finance.view` (ansehen), `finance.edit` (Angebote und Entwürfe bearbeiten, Artikel), `finance.issue`
  (Rechnungen ausstellen, stornieren, Zahlungen erfassen; sensibel, standardmäßig Admin), `finance.manage`
  (Rechnungsdaten).
- **Regeln (GoBD, § 14 UStG)**: Belege starten als Entwurf ohne Nummer. Beim Ausstellen prüft die Datenbank die
  Pflichtangaben (Firmendaten, Empfängeranschrift, mindestens eine Position), vergibt die lückenlose Nummer je Art und
  Jahr (AN-/RE-/GS-2026-0001) und friert Absender, Empfänger, Positionen und Beträge ein. Änderungen oder Löschen
  ausgestellter Belege lehnt die Datenbank ab (auch über die API). Korrektur nur per Storno: Gutschrift mit negativen
  Positionen und Verweis auf das Original, Pflichtgrund.
- **Rechnen**: Position netto = Menge × Preis − Rabatt (kaufmännisch gerundet), Umsatzsteuer je Steuersatz auf die
  Netto-Summe; Kleinunternehmer ohne Umsatzsteuer mit gesetzlichem Hinweis. Zahlungen (auch Teilzahlungen) setzen den
  Status „Teilweise bezahlt“/„Bezahlt“; überfällig ergibt sich aus dem Fälligkeitsdatum.
- **Angebote**: Ausstellen → „Versendet“, annehmen/ablehnen, in Rechnungsentwurf übernehmen (Positionen werden kopiert).
- **PDF** (DIN A4, ohne externen Dienst, `pdf-lib`): Briefkopf, Anschriftfeld, Infoblock, Positionstabelle mit
  Seitenumbruch, Steuer je Satz, Zahlungshinweis mit IBAN, Fußzeile mit Firmendaten, Wasserzeichen „ENTWURF“.
- **Protokoll** (Anlegen, Statuswechsel, Löschen von Entwürfen, Zahlungen, Rechnungsdaten) und **Suche** (ausgestellte
  Belege nach Nummer, Empfänger, Betreff).
- **Oberfläche** (`/finanzen`): Übersicht (offen, überfällig, Zahlungseingang, offene Angebote, Entwürfe), Listen für
  Rechnungen/Angebote/Gutschriften mit Suche und Statusfilter, Beleg mit Kopfdaten, Positionen (aus Artikel oder frei,
  Reihenfolge), Ausstellen, Zahlungen, Storno, PDF; Artikel; Einstellungen. Im CRM zeigt jeder Kunde seine Belege mit
  „Neues Angebot“/„Neue Rechnung“.
- **Noch nicht enthalten**: E-Mail-Versand der Belege (braucht einen E-Mail-Anbieter), E-Rechnung (XRechnung/ZUGFeRD,
  im B2B-Bereich in Deutschland schrittweise Pflicht), Mahnwesen, DATEV-Export, Fremdwährungen. Die steuerliche
  Richtigkeit der Einstellungen verantwortet das Unternehmen bzw. seine Steuerberatung.
- Tests: 574 Datenbank-, 205 Unit-, 103 Browsertests.

---

### Phase 3a-2 – Belegversand per Gmail, umgesetzt am 28.11.2026

- Entscheidung (28.11.2026): E-Mail-Versand über **Gmail**. Umsetzung: Jedes Unternehmen verbindet sein eigenes
  Gmail-/Google-Workspace-Postfach per OAuth (nur `gmail.send`); Belege gehen von der eigenen Adresse raus und liegen
  dort unter „Gesendet“.
- **Datenbank** (Migration `20261128240000_finance_mail.sql`, live, Prüfsumme live = lokal): verbundenes Postfach je
  Unternehmen (Refresh-Token AES-256-GCM-verschlüsselt mit einem aus dem Client-Secret abgeleiteten Schlüssel; die
  Spalte ist für Nutzer per Spaltenrechten nicht lesbar), Versandprotokoll je Beleg. Verbinden/Trennen nur mit
  `finance.manage`, Versand von Rechnungen/Gutschriften mit `finance.issue`, von Angeboten mit `finance.edit`;
  Entwürfe werden nicht versendet. Verbinden, Versand und Trennen stehen im Protokoll (ohne Token).
- **Ablauf**: „Mit Gmail verbinden“ → Google → Rückleitung `/api/google/callback` (Schutz per Einmal-Zustand im
  httpOnly-Cookie) → Postfach gespeichert. Am Beleg: Empfänger (vorbelegt mit der Kunden-E-Mail), CC, Betreff und
  Text (Vorschlag mit Nummer, Betrag, Fälligkeit), PDF automatisch im Anhang, Versandverlauf. Widerrufene Zugänge
  werden verständlich gemeldet und in den Einstellungen angezeigt; Trennen widerruft die Freigabe bei Google.
- **Einrichtung** (einmalig, durch den Betreiber): Google-Cloud-OAuth-Client und `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  in Vercel, siehe [`GMAIL.md`](GMAIL.md). Ohne diese Werte zeigt NOVA „noch nicht eingerichtet“.
- **Vor dem Verkauf**: Google-Verifizierung der App (sensibler Bereich `gmail.send`; braucht Domain und Datenschutzerklärung).
- Tests: 603 Datenbank-, 217 Unit-, 107 Browsertests (Browsertests gegen eine lokale Google-Attrappe; der echte
  Google-Versand ist erst nach der Einrichtung prüfbar).

---

## 0. Bestandsaufnahme

| Bereich | Bestand | Bewertung |
|---|---|---|
| Frontend | Next.js 16.4 (App Router, Cache Components), React 19.3, TypeScript, Tailwind 4, shadcn/ui, Lucide, Recharts, Light/Dark | Entspricht dem geforderten Stack, bleibt |
| Backend | Server Actions und Route Handler in Next.js, Fachlogik in `src/modules/<modul>/{domain,server,ui}` | Klar abgegrenzt, wird zum modularen Monolithen ausgebaut |
| Datenbank | Supabase Postgres (Projekt `nova-ai`, Frankfurt), 5 Migrationen, Schema `analytics`, RLS auf allen 28 Tabellen | Bleibt, wird um weitere Schemas erweitert |
| Auth | Supabase Auth: Registrierung mit E-Mail-Bestätigung, Login, Logout, Passwort zurücksetzen | Bleibt, wird um MFA und Sitzungsverwaltung erweitert |
| Mandanten | `analytics.organizations`, `organization_members` (Rollen owner/admin/analyst/viewer), Einladungen, Audit-Log | Funktioniert, liegt aber im Analytics-Schema → wird zum gemeinsamen Kern `core` |
| Analytics | Tracker (1,9 KB), Erfassung `/api/e`, Dashboard, Echtzeit, Besucheranalyse (Phasen 1–6 von 13) | Bleibt vollständig erhalten, wird Modul von NOVA |
| Tests | 119 Unit-, 133 Datenbank- (pgTAP), 34 Browser-Tests (Playwright + axe) | Grundlage für alle weiteren Phasen |
| Betrieb | Vercel (Hobby), GitHub, pg_cron | Für kommerziellen Betrieb fehlen Pakete, siehe Abschnitt 7 |
| Nicht vorhanden | Abos/Zahlungen, NOVA MASTER, Business-Module, Verkaufswebsite, REST-API, Dateien, Benachrichtigungen, Suche, i18n | Wird gebaut |

**Analytics liegt in diesem Repo** (kein fremdes Projekt, keine fremde API). Die Integration ist deshalb eine echte
Datenbank- und Code-Integration, keine Schnittstelle zu einem Fremdsystem.

### Risiken

1. **Umzug der Mandanten-Tabellen** von `analytics` nach `core`: betrifft die laufende Produktion. Lösung: Tabellen werden
   per `ALTER TABLE … SET SCHEMA` verschoben (keine Datenkopie, IDs und Fremdschlüssel bleiben), alle Funktionen neu
   angelegt, abgesichert durch die vorhandenen 133 Datenbanktests und die Browsertests.
2. **Umfang**: Der Master-Prompt beschreibt ein Produkt, an dem ein Team typischerweise viele Monate arbeitet. Es wird in
   Phasen gebaut; jede Phase ist für sich lauffähig und getestet.
3. **Rechtliches** (Rechnungen/GoBD, AGB, Datenschutz, AVV): Technik wird gebaut, Texte und Prozesse müssen fachlich
   geprüft werden. Es werden keine Zertifizierungen oder Rechtssicherheit behauptet.

---

## 1. Verständnis des Systems

NOVA ist **eine** Plattform, kein Bündel einzelner Apps:

- **Ein Unternehmen = ein Mandant (Tenant).** Es registriert sich selbst, bucht ein Paket, lädt Mitarbeiter ein und
  aktiviert Module. Alle Daten tragen die Tenant-ID; die Datenbank selbst verhindert Zugriffe über Mandantengrenzen.
- **NOVA Core** liefert allen Modulen dasselbe Fundament: Benutzer, Mandanten, Rollen und Rechte, Modulfreischaltung,
  Einstellungen, Benachrichtigungen, Suche, Dateien, Audit-Log, API-Schlüssel, Webhooks.
- **Fachmodule** (CRM, Projekte, Kalender, HR, Finanzen, Dokumente, Kommunikation, Support, Lager, Marketing,
  Automatisierungen, Analytics) nutzen den Kern und sind über echte Fremdschlüssel miteinander verbunden.
- **Das Abo bestimmt, was ein Mandant darf.** Stripe meldet Zahlungen per Webhook, daraus entsteht der Lizenzstatus,
  daraus die freigeschalteten Module und Limits – geprüft im Server **und** in der Datenbank.
- **NOVA MASTER** ist der Betreiberbereich: Kunden, Pakete, Preise, Lizenzen, Systemzustand. Er sieht keine
  Kundeninhalte ohne protokollierte, begründete Freigabe.
- **Die Verkaufswebsite** führt Besucher bis zur Registrierung und Bezahlung, ohne manuelle Einrichtung.

---

## 2. Aufbau der fertigen Plattform

### 2.1 Technische Entscheidung (Abweichung vom Vorschlag im Master-Prompt)

Der Master-Prompt nennt NestJS, Prisma und Redis „nach Möglichkeit“ und fordert zugleich, Bestehendes zu erhalten und
unnötige Komplexität zu vermeiden. Empfehlung und Plan:

| Vorschlag | Entscheidung | Begründung |
|---|---|---|
| NestJS | **Next.js-Server** (Route Handler `/api/v1`, Server Actions) mit strikter Modulstruktur | Bestehendes System, ein Deployment, keine zweite Laufzeit. Module sind so geschnitten, dass sie später ausgelagert werden können. |
| Prisma | **SQL-Migrationen (Supabase CLI) + generierte TypeScript-Typen** | Prisma verbindet sich als Superuser und **umgeht Row Level Security**. Die Mandantentrennung in der Datenbank ist das wichtigste Sicherheitsmerkmal und bleibt erhalten. |
| Redis | **Postgres-Warteschlange (pgmq/Supabase Queues) + pg_cron**, Rate Limits in Postgres | Ein System weniger; reicht für viele tausend Mandanten. Redis kann später ergänzt werden. |
| S3 | **Supabase Storage** (S3-kompatibel), private Buckets, Pfad beginnt mit Tenant-ID, RLS auf Dateien | Gleiche Rechteprüfung wie bei Daten, signierte Download-Links |
| Stripe | **Stripe** (Checkout, Kundenportal, Webhooks) | wie gefordert |
| E-Mail | SMTP-/API-Anbieter (Vorschlag: Resend oder Postmark, EU-Region) | wie gefordert, Zugangsdaten fehlen |
| Monitoring | Sentry (Fehler), Vercel-Logs, eigener Statusbereich mit echten Prüfungen | wie gefordert, Konto fehlt |
| OpenAPI | Aus den zod-Schemas der API erzeugt (`zod` 4 → JSON Schema) | Eine Quelle für Validierung und Doku |
| Echtzeit-Chat | Supabase Realtime (WebSocket) mit RLS | kein eigener Socket-Server nötig |

### 2.2 Bereiche der Anwendung

| URL | Bereich | Zugang |
|---|---|---|
| `/`, `/preise`, `/module/…`, `/faq`, `/impressum` … | Verkaufswebsite | öffentlich |
| `/login`, `/registrieren`, `/passwort-…` | Anmeldung | öffentlich |
| `/start` | Registrierungs- und Einrichtungsassistent | angemeldet |
| `/app/[tenant]/…` | Kundenbereich mit allen Modulen | Mitglied des Mandanten |
| `/app/[tenant]/verwaltung/…` | Kundenportal (Profil, Mitarbeiter, Rollen, Abo, Rechnungen, API, Sicherheit, White Label) | Owner/Admin |
| `/analytics/[siteId]/…` | bestehendes Analytics (bleibt erreichbar, wird in die Navigation eingebunden) | wie bisher |
| `/portal/[tenant]/…` | Kundenportal für Endkunden (Support-Tickets) | Endkunden-Zugang |
| `/master/…` | NOVA MASTER | nur Plattform-Admins mit MFA |
| `/api/v1/…` | REST-API (OpenAPI unter `/api/v1/openapi.json`) | API-Schlüssel |
| `/api/webhooks/stripe` | Stripe-Ereignisse | Signaturprüfung |

Der Mandant steht in der URL (`/app/acme/…`). Der Server prüft bei **jeder** Anfrage, ob der angemeldete Benutzer
Mitglied ist – die URL ist nur eine Auswahl, keine Berechtigung.

### 2.3 Datenbank-Schemas

| Schema | Inhalt |
|---|---|
| `core` | tenants, tenant_members, invitations, departments, teams, roles, permissions, role_permissions, member_roles, tenant_settings, tenant_modules, notifications, notification_preferences, audit_logs, files, search_index, domain_events, api_keys, webhook_endpoints, webhook_deliveries, integrations, user_profiles, user_sessions |
| `billing` | plans, plan_prices, plan_modules, modules, module_prices, subscriptions, subscription_items, invoices, payment_events, coupons, usage_records, license_records |
| `platform` | platform_admins, admin_access_grants (begründete Einsicht), system_checks, maintenance |
| `crm` | customers, contacts, leads, pipelines, pipeline_stages, opportunities, customer_activities, customer_notes, tags |
| `projects` | projects, project_members, tasks (mit parent_id für Unteraufgaben), task_dependencies, checklists, task_comments, milestones, time_entries, project_templates |
| `calendar` | calendars, calendar_events, event_participants, event_reminders, calendar_permissions |
| `hr` | employees, positions, leave_types, leave_requests, absences, time_records, onboarding_plans, onboarding_tasks, employee_documents |
| `finance` | invoices, invoice_items, invoice_corrections, quotes, quote_items, expenses, suppliers, payment_records, number_sequences, tax_rates |
| `documents` | folders, documents, document_versions, document_links, document_permissions |
| `messaging` | conversations, conversation_members, messages, message_attachments, message_reads |
| `support` | tickets, ticket_comments, ticket_categories, sla_policies, kb_categories, kb_articles, portal_users |
| `inventory` | products, product_categories, warehouses, warehouse_locations, stock_levels, inventory_movements, purchase_orders, purchase_order_items |
| `marketing` | campaigns, campaign_audiences, campaign_activities, marketing_consents, sales_activities |
| `automation` | workflows, workflow_versions, workflow_runs, workflow_run_steps |
| `analytics` | **bestehend**, nur die Mandanten-Tabellen wandern nach `core` |

Konventionen: `uuid`-Primärschlüssel, `tenant_id not null` mit Fremdschlüssel auf `core.tenants` und Index,
`created_at/updated_at/created_by`, Soft-Delete nur wo fachlich nötig (`archived_at`), Fremdschlüssel innerhalb eines
Mandanten über zusammengesetzte Schlüssel `(tenant_id, id)`, damit ein Datensatz nie auf einen fremden Mandanten zeigen
kann.

### 2.4 Sicherheitsmodell (Defense in Depth)

1. **Proxy**: Sitzung erneuern, nicht angemeldete Nutzer umleiten.
2. **Server**: jede Action/API prüft Sitzung, Mandant, Recht und Modulfreischaltung (`requirePermission(tenant, "crm.customers.write")`).
3. **Datenbank (RLS)**: jede Tabelle hat Policies mit `core.can(tenant_id, 'crm.customers.read')`. Diese Funktion
   prüft Mitgliedschaft, Rolle/Recht, **Modulfreischaltung und Lizenzstatus**. Ein gesperrtes Modul ist dadurch auch
   über direkte API-Aufrufe nicht nutzbar.
4. **Constraints**: zusammengesetzte Fremdschlüssel mit Tenant-ID, Prüfungen, unveränderliche Rechnungen per Trigger.
5. **Audit**: Änderungen an sicherheitsrelevanten Daten per Trigger, unveränderlich.
6. **Tests**: pgTAP-Tests „Mandant A gegen Mandant B“ für jede Tabelle, API-Tests, Browser-Tests.

### 2.5 Rollen und Rechte

- **Basisrollen je Mandant**: Owner, Administrator, Mitglied, Betrachter (die bisherige Analytics-Rolle „Analyst“ wird zu
  „Mitglied“; die Rechte bleiben gleich).
- **Eigene Rollen**: Mandanten legen Rollen mit Einzelrechten an (Katalog `modul.ressource.aktion`, z. B.
  `hr.employees.read_sensitive`, `finance.invoices.issue`).
- **Abteilungen/Teams** schränken zusätzlich ein, wo fachlich nötig (z. B. Teamkalender, Projektteams).
- **Sensible HR-Felder** (Gehalt, Bankdaten, Gesundheit) liegen in eigenen Tabellen mit eigenem Recht.

---

## 3. Module

| Modul | Kernfunktionen | Phase |
|---|---|---|
| **Core** | Mandanten, Mitglieder, Einladungen, Rollen/Rechte, Abteilungen/Teams, Moduleinstellungen, Benachrichtigungen, globale Suche, Dateien, Audit, Sitzungen, MFA | 1 |
| **CRM** | Kunden (Firma/privat), Ansprechpartner, Leads mit Bewertung und Umwandlung, Pipelines, Verkaufschancen, Aktivitäten, Notizen, Import/Export, Dublettenprüfung | 2 |
| **Projekte** | Projekte, Vorlagen, Aufgaben, Unteraufgaben, Checklisten, Abhängigkeiten, Meilensteine, Kommentare, Zeiterfassung; Kanban, Liste, Kalender, Timeline/Gantt | 2 |
| **Kalender** | Persönlich/Team/Unternehmen, Teilnehmer, Wiederholungen, Erinnerungen, Zeitzonen, Verfügbarkeit, iCal-Export | 2 |
| **HR** | Mitarbeiter, Abteilungen, Positionen, Vorgesetzte, Urlaub/Abwesenheit mit Genehmigung, Resturlaub, Arbeitszeiten, Onboarding | 2 |
| **Finanzen** | Angebote → Rechnungen, fortlaufende Nummern, Steuern, Storno/Korrektur statt Überschreiben, PDF, XRechnung/ZUGFeRD, Ausgaben, Lieferanten, Übersicht | 3 |
| **Dokumente** | Ordner, Upload, Versionen, Vorschau, Freigaben, Zuordnung zu Kunden/Projekten/Mitarbeitern/Rechnungen | 3 |
| **Kommunikation** | Direktnachrichten, Gruppen, Team-/Projektkanäle, Erwähnungen, Lesestatus, Echtzeit | 3 |
| **Support** | Tickets, SLA, Eskalation, interne Notizen, Kundenportal, Wissensdatenbank | 3 |
| **Lager** | Artikel, Lagerorte/-plätze, Bewegungen (unveränderliches Journal), Inventur, Mindestbestand, Lieferanten, Bestellungen | 4 |
| **Marketing** | Kampagnen, Zielgruppen, Budgets, Vertriebsaktivitäten, Einwilligungen/Abmeldungen | 4 |
| **Automatisierungen** | Visueller Workflow-Editor, Trigger/Bedingungen/Aktionen/Verzögerungen, Ausführungshistorie, Limits, Schleifenschutz | 4 |
| **Analytics** | bestehend; Einbindung in Navigation, Rechte, Lizenz; Phasen 7–13 werden danach fertiggestellt | 5 |
| **SaaS/Billing** | Pakete, Testphase, Stripe Checkout/Portal/Webhooks, Lizenzstatus, Zusatzmodule, Zusatzbenutzer, Gutscheine | 6 |
| **NOVA MASTER** | Kennzahlen, Unternehmen, Pakete, Module, Systemstatus, begründete Einsicht | 7 |
| **Website** | 20 Seiten inkl. Preise, SEO, Cookie-Einstellungen | 8 |
| **API/Integrationen** | REST `/api/v1`, OpenAPI, API-Schlüssel, Webhooks, Integrationsverwaltung | ab 2, je Modul |

---

## 4. Verbindung der Module

**Direkte Datenbeziehungen** (echte Fremdschlüssel, immer innerhalb desselben Mandanten):

```
crm.customers ──< projects.projects ──< projects.tasks ──< projects.time_entries >── hr.employees
     │                  │                     │
     ├──< finance.quotes ──> finance.invoices │ (Aufgabe mit Fälligkeit erscheint im Kalender)
     ├──< finance.invoices                    │
     ├──< support.tickets >── projects.projects (optional)
     ├──< marketing.campaign_audiences
     └──< calendar.calendar_events >── projects.tasks / hr.absences / support.tickets
hr.employees ── core.tenant_members (Login) ; hr.absences → Verfügbarkeit im Kalender und in Projekten
inventory.products >── finance.suppliers ; inventory.inventory_movements (Journal)
documents.document_links → customer | project | task | employee | invoice | ticket (je eigene FK-Spalte)
finance.expenses >── projects.projects
```

**Gemeinsame Dienste**, über die Module lose gekoppelt sind:

- **Ereignisse** (`core.domain_events`, Outbox): Trigger schreiben z. B. `crm.customer.created`,
  `finance.invoice.overdue`, `support.ticket.priority_changed`, `inventory.stock.below_minimum`.
  Daraus speisen sich **Automatisierungen**, **Webhooks** an Kunden und **Benachrichtigungen** – in einem
  Hintergrundjob, mit Tenant-Kontext, idempotent und mit Wiederholungen.
- **Suche** (`core.search_index`): Trigger pflegen Titel und Suchtext jedes Datensatzes mit dem nötigen Recht; die
  Suche liefert nur, was der Benutzer lesen darf.
- **Dateien** (`core.files` + Storage): ein Upload-Weg für alle Module.
- **Audit-Log**: ein Protokoll für alle Module.

---

## 5. SaaS-Verkaufsmodell

**Ablauf ohne manuelle Einrichtung**: Website → Preise → Registrierung → E-Mail bestätigen → Unternehmen anlegen →
Paket wählen → 14 Tage testen (ohne Zahlungsdaten) oder direkt per Stripe Checkout zahlen → Module wählen →
Mitarbeiter einladen → arbeiten.

**Pakete** (Startwerte aus dem Master-Prompt, im NOVA MASTER änderbar):

| Paket | Monat | Jahr (Vorschlag: 2 Monate geschenkt) | Benutzer | Module (Vorschlag) |
|---|---|---|---|---|
| Starter | 29 € | 290 € | 5 | CRM, Projekte, Kalender, Dokumente, Support |
| Business | 79 € | 790 € | 20 | + HR, Finanzen, Kommunikation, Lager, Marketing, Automatisierungen, Analytics |
| Enterprise | 199 € | 1.990 € | 100 | alle Module, höhere Limits, erweiterte Administration, SSO, White-Label-Option |

Zusätzlich: einzelne Module, Zusatzbenutzer, Zusatzspeicher, Gutscheine, befristete Angebote, individuelle
Enterprise-Angebote. Preise liegen in der Datenbank und werden mit Stripe-Produkten synchronisiert (eine
Preisänderung erzeugt einen neuen Stripe-Preis; bestehende Abos bleiben, bis sie umgestellt werden).

**Lizenzstatus** (aus Stripe-Webhooks, nie aus dem Browser):

| Status | Zugriff |
|---|---|
| Testphase | voll im gewählten Paket bis Ablauf |
| Aktiv | voll |
| Zahlung ausstehend (`past_due`) | Kulanzphase (Vorschlag 7 Tage) mit Hinweis, danach nur Lesen |
| Gekündigt zum Laufzeitende | voll bis Laufzeitende, danach nur Lesen und Export |
| Abgelaufen | nur Lesen und Export (Datenmitnahme bleibt möglich) |
| Gesperrt (durch Betreiber) | kein Zugriff außer Owner-Export |

Der Lizenzstatus fließt in `core.can(…)` ein: Module, Benutzerlimits und Speicherlimits werden in der Datenbank
durchgesetzt. Test F/G des Master-Prompts werden mit signierten Stripe-Test-Webhooks automatisiert geprüft.

---

## 6. NOVA-MASTER-Administration

- **Zugang**: eigene Tabelle `platform.platform_admins` (nicht über Mandantenrollen erreichbar), **MFA Pflicht** (Supabase
  TOTP, Sitzung muss `aal2` sein), Rollen Super-Admin, Billing, Support, Nur-Lesen. Jede Aktion im Audit-Log.
- **Dashboard** aus echten Abrechnungsdaten: Unternehmen gesamt/aktiv, Testkunden, zahlende Kunden, MRR/ARR aus
  aktiven Abo-Positionen, Kündigungen, neue Registrierungen, Zahlungsprobleme, Modulnutzung, offene Supportfälle.
- **Unternehmen**: suchen, Details (Abo, Lizenz, Benutzerzahl, Module, Speicher), sperren/entsperren, Kulanz verlängern.
- **Pakete und Module**: anlegen, ändern, Preise (mit Stripe-Sync), Limits, Modulzuordnung, Testphasen; Löschen nur ohne
  Referenzen.
- **System**: echte Prüfungen (Datenbank, Warteschlange, letzte Stripe-Webhooks, E-Mail-Zustellung, Speicher,
  pg_cron-Läufe), Fehlerprotokolle, Wartungsmodus, Sicherheitsereignisse.
- **Einsicht in Kundendaten**: grundsätzlich **nicht** möglich. Nur über eine befristete Freigabe mit Begründung
  (`platform.admin_access_grants`), sichtbar im Audit-Log des Kunden; optional nur nach Zustimmung des Kunden-Owners.

---

## 7. Fehlende Voraussetzungen

### Von dir benötigt (kann ich nicht selbst anlegen)

| Was | Wofür | Kosten |
|---|---|---|
| **Stripe-Konto** (zuerst nur Testmodus: Secret Key, Webhook-Secret) | Abos, Zahlungen | Gebühren je Zahlung |
| **Eigene Domain** (z. B. `nova-….de`) | Website, E-Mail-Absender, White Label | ca. 10–20 €/Jahr |
| **E-Mail-Anbieter** (z. B. Resend, EU) + Domain-Bestätigung | Bestätigungs-, Einladungs-, Rechnungs-E-Mails (aktuell max. wenige Mails/Stunde) | kostenlos bis kleines Volumen |
| **Supabase Service-Role-Key** als geheime Vercel-Variable | Stripe-Webhooks, Hintergrundjobs, NOVA MASTER | – |
| **Sentry-Konto** (optional) | Fehlerüberwachung | kostenloser Einstieg |

### Kostenpflichtig für echten Verkauf (Entscheidung von dir)

| Was | Warum |
|---|---|
| **Vercel Pro** (ca. 20 $/Monat) | Der kostenlose Hobby-Tarif ist laut Vercel nur für nicht-kommerzielle Nutzung erlaubt |
| **Supabase Pro** (ca. 25 $/Monat) | Tägliche Backups, kein Pausieren, höhere Limits; ohne Pro keine verlässliche Wiederherstellung (Test K) |
| Optional: Stripe Tax | automatische Umsatzsteuer (EU, Reverse Charge) |
| Optional: Virenscan-Dienst | Virenprüfung von Uploads (auf Vercel nicht selbst betreibbar) |

### Rechtlich / organisatorisch (nicht technisch lösbar)

- Unternehmen bzw. Rechtsform als Verkäufer (Pflicht für Stripe-Live und Impressum)
- Impressum, Datenschutzerklärung, AGB/Nutzungsbedingungen, Auftragsverarbeitungsvertrag (AVV), Liste der
  Unterauftragsverarbeiter – Vorlagen werden gebaut, **müssen anwaltlich geprüft werden**
- Rechnungsmodul: fachliche Prüfung durch Steuerberater (GoBD, Pflichtangaben)
- Markenrecherche für „NOVA“

### Technisch später zu klären

- Enterprise-SSO (SAML) ist bei Supabase an den Pro-Tarif gebunden
- Passkeys: abhängig von der Unterstützung in Supabase Auth, sonst später
- XRechnung-Validierung mit dem offiziellen KoSIT-Validator (Java) läuft nicht auf Vercel → Validierung im Test/CI

---

## 8. Entwicklungsplan

Reihenfolge nach Master-Prompt, mit einer Ausnahme: Die **Modulfreischaltung** (welcher Mandant darf welches Modul)
entsteht schon in Phase 1 im Kern, damit jedes Modul von Anfang an gesperrt werden kann. Stripe füllt sie in Phase 6.

| Phase | Inhalt | Abhängig von | Abnahme |
|---|---|---|---|
| **1a** | Schema `core`: Mandanten-Tabellen aus `analytics` verschieben, Analytics darauf umstellen, alle bisherigen Tests grün | – | 133 DB-Tests, 34 E2E, Produktionsdaten erhalten |
| **1b** | Rollen/Rechte-Katalog, eigene Rollen, Abteilungen/Teams, `core.can()`, Modulfreischaltung | 1a | pgTAP A-gegen-B, Rechteeskalation |
| **1c** | Plattform-Oberfläche: `/app/[tenant]`, Navigation, Mandantenwechsel, Verwaltung, Audit-Ansicht ✓ | 1b | E2E Test A, B, C |
| **1d** | Benachrichtigungen, globale Suche, Dateien; Sicherheit: MFA (TOTP), Sitzungsliste und Widerruf, Login-Schutz, Sicherheitsheader | 1c | E2E |
| 2 | CRM, Projekte, Kalender, HR (+ REST-API je Modul) | 1 | Test E (Teil) |
| 3 | Finanzen, Dokumente, Kommunikation, Support | 2 | Test E |
| 4 | Lager, Marketing, Automatisierungen | 3 | Workflow-Tests |
| 5 | Analytics-Integration abschließen, Analytics-Phasen 7–13 | 1 | Test I |
| 6 | Registrierung mit Paketwahl, Stripe, Lizenzen, Kundenportal Abo | 1, Stripe-Konto | Test D, F, G |
| 7 | NOVA MASTER | 6 | Test H |
| 8 | Verkaufswebsite, SEO, Rechtstexte (Entwürfe) | 6 | Lighthouse, axe |
| 9 | Produktionsreife: Security-Tests, Lasttests, Backup-/Restore-Test, Doku, Abnahme A–L | alles | ehrlicher Abschlussbericht |

Jede Phase endet mit: Migrationen laufen lokal und produktiv, Tests grün, Doku aktualisiert, Commit und Deployment.
