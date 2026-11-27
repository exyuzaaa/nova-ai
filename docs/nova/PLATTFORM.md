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
| **1c** | Plattform-Oberfläche: `/app/[tenant]`, Navigation aller Module, Mandantenwechsel, Kundenportal-Grundlagen, Benachrichtigungen, globale Suche, Dateien, Audit-Ansicht | 1b | E2E Test A, B, C |
| **1d** | Sicherheit: MFA (TOTP), Sitzungsliste und Widerruf, Login-Schutz, Sicherheitsheader | 1a | E2E |
| 2 | CRM, Projekte, Kalender, HR (+ REST-API je Modul) | 1 | Test E (Teil) |
| 3 | Finanzen, Dokumente, Kommunikation, Support | 2 | Test E |
| 4 | Lager, Marketing, Automatisierungen | 3 | Workflow-Tests |
| 5 | Analytics-Integration abschließen, Analytics-Phasen 7–13 | 1 | Test I |
| 6 | Registrierung mit Paketwahl, Stripe, Lizenzen, Kundenportal Abo | 1, Stripe-Konto | Test D, F, G |
| 7 | NOVA MASTER | 6 | Test H |
| 8 | Verkaufswebsite, SEO, Rechtstexte (Entwürfe) | 6 | Lighthouse, axe |
| 9 | Produktionsreife: Security-Tests, Lasttests, Backup-/Restore-Test, Doku, Abnahme A–L | alles | ehrlicher Abschlussbericht |

Jede Phase endet mit: Migrationen laufen lokal und produktiv, Tests grün, Doku aktualisiert, Commit und Deployment.
