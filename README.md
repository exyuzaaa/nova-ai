# NOVA AI

Next.js-Anwendung mit dem Modul **NOVA ANALYTICS** (datenschutzfreundliche Web-Analyse) auf Supabase.
Architektur und Entwicklungsplan: [`docs/analytics/ARCHITEKTUR.md`](docs/analytics/ARCHITEKTUR.md).

**Ausbau zur NOVA-Plattform** (Kern, Business-Module, Abos, NOVA MASTER, Website):
[`docs/nova/PLATTFORM.md`](docs/nova/PLATTFORM.md)

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 1 | Architektur, Datenbankschema, Plan | ✓ |
| 2 | Designsystem (Light/Dark), Dashboard mit gekennzeichneten Demo-Daten | ✓ |
| 3 | Supabase Auth, Organisationen, Websites, Rollen, Einladungen, RLS | ✓ |
| 4 | Tracking-Skript, Event-Erfassung, Installationsstatus | ✓ |
| 5 | Dashboard mit echten Daten (Auswertung in der Datenbank, Zeitzone der Website) | ✓ |
| 6 | Echtzeit (aktive Besucher, alle 10 s) und Besucheranalyse | ✓ |
| 7 | Traffic- und Seitenanalyse | offen |

**NOVA-Plattform** ([Plan](docs/nova/PLATTFORM.md))

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Bestandsaufnahme, Architektur, Entwicklungsplan | ✓ |
| 1a | Gemeinsamer Kern `core`: Unternehmen, Mitglieder, Einladungen, Audit-Log; Analytics nutzt ihn | ✓ |
| 1b | Rechtekatalog, eigene Rollen, Abteilungen/Teams, Modulfreischaltung, Unternehmensprofil, Sperre | ✓ |
| 1c | Plattform-Oberfläche `/app/[unternehmen]`: Navigation, Unternehmenswechsel, Übersicht, Verwaltung (Profil, Mitglieder, Rollen, Abteilungen/Teams, Module, Protokoll) | ✓ |
| 1d-1 | Benachrichtigungen (Glocke, Eingang, Einstellungen) und globale Suche mit Rechteprüfung | ✓ |
| 1d-2 | Zwei-Faktor-Anmeldung (TOTP), Geräteverwaltung, sofortiger Entzug beendeter Sitzungen, Sicherheitsheader | ✓ |
| 2 | CRM, Projekte, Kalender, Personal | offen |

### Phase 3 im Überblick

- **Anmeldung** mit E-Mail und Passwort über Supabase Auth: Registrierung mit E-Mail-Bestätigung, Login, Logout,
  Passwort vergessen/zurücksetzen. Passwortregel: mindestens 10 Zeichen mit Buchstaben und Ziffern.
- **Geschützte Bereiche**: `src/proxy.ts` erneuert die Sitzung und leitet nicht angemeldete Nutzer zur Anmeldung um.
  Jede Server-Funktion prüft zusätzlich selbst (`requireUser`, Rollenprüfung), und jede Datenbankabfrage läuft mit der
  Sitzung des Nutzers durch Row Level Security.
- **Organisationen und Websites**: Einrichtung in zwei Schritten (Organisation → erste Website mit automatisch
  erzeugter Tracking-ID), weitere Websites über den Website-Wechsler.
- **Rollen**: Owner, Administrator, Analyst, Viewer. Mitglieder kommen ausschließlich per Einladung hinzu
  (Link, 7 Tage gültig, nur für die eingeladene, bestätigte E-Mail-Adresse, einmalig verwendbar).
- **Mandantentrennung**: Schema `analytics` mit RLS auf allen 28 Tabellen; `anon` hat keinen Zugriff.
  Änderungen an Organisationen, Mitgliedern, Einladungen, Websites und Tracking-Einstellungen landen per Trigger
  in einem unveränderlichen Audit-Log.
- **Keine Zugangsdaten im Frontend**: Supabase-URL und Publishable Key werden nur serverseitig gelesen
  (kein `NEXT_PUBLIC_`). Ein Service-Role-Key wird nicht benötigt.

Tracking einbauen: [`docs/analytics/TRACKING.md`](docs/analytics/TRACKING.md)

## Lokale Entwicklung

Voraussetzungen: Node.js 22, Docker (für den lokalen Supabase-Stack).

```bash
npm install
```

```bash
npx supabase start -x studio,edge-runtime,realtime,storage-api,imgproxy,logflare,vector,supavisor,postgres-meta
```

`npx supabase status` zeigt URL und Publishable Key. Dann `.env.example` nach `.env.local` kopieren und ausfüllen
(lokal: `SUPABASE_URL=http://127.0.0.1:54321`, `APP_URL=http://localhost:3100`).

```bash
npm run dev -- -p 3100
```

E-Mails (Bestätigung, Passwort zurücksetzen) landen lokal in Mailpit: http://127.0.0.1:54324

## Tests

| Befehl | Inhalt |
|---|---|
| `npm run check` | Typprüfung, ESLint, Unit-Tests (Vitest) |
| `npm run db:test` | Datenbanktests (pgTAP): Kern, Mandantentrennung, Rollen, Einladungen, Audit-Log, Analytics |
| `npm run build && npm run test:e2e` | End-to-End (Playwright) gegen echten lokalen Supabase-Stack inkl. axe-Prüfungen |

Nach Schemaänderungen: `npx supabase db reset` (spielt alle Migrationen neu ein) und `npm run db:types`.

## Deployment

Schritte für das bestehende Supabase-Projekt und Vercel: [`docs/analytics/SUPABASE-SETUP.md`](docs/analytics/SUPABASE-SETUP.md).

## Struktur

```
src/proxy.ts                              Sitzung erneuern, geschützte Bereiche
src/app/(auth)/                           Anmelden, Registrieren, Passwort vergessen/neu
src/app/auth/confirm/                     Ziel der E-Mail-Links (token_hash-Verfahren)
src/app/onboarding/                       Organisation + erste Website
src/app/einladung/[token]/                Einladung ansehen und annehmen
src/app/(platform)/app/                   NOVA-Plattform: Einstieg, Übersicht, Verwaltung je Unternehmen
src/app/(analytics)/analytics/            Dashboard, Einstellungen
src/lib/supabase/                         Server-Client, Umgebung, generierte DB-Typen
src/modules/auth/                         Validierung, Weiterleitungsschutz, Sitzung, Server Actions, Formulare
src/modules/core/                         NOVA Core: Rollen, Unternehmen, Mitglieder, Einladungen (Server + Domain)
src/modules/analytics/                    Domain-Logik, Datenquellen, Mandanten, UI
supabase/migrations/                      Schemas analytics und core (+ leere Modul-Schemas)
supabase/tests/                           pgTAP-Tests
supabase/templates/                       Deutsche E-Mail-Vorlagen
e2e/                                      Playwright-Tests
```
