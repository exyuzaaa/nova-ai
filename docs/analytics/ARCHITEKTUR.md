# NOVA ANALYTICS – Architekturplan (Phase 1)

**Stand:** 26.11.2026 · **Status:** Entwurf zur Freigabe · **Code-Änderungen am bestehenden Projekt:** keine

Zugehörige Dateien im Repository:

| Datei | Inhalt |
|---|---|
| `supabase/migrations/` | Datenbankschema (Schema `analytics`, 28 Tabellen, RLS, Funktionen, Partitionierung) |
| `supabase/tests/analytics_rls.test.sql` | pgTAP-Tests zu Mandantentrennung, Rollen, Einladungen, Audit-Log |

---

> **Nachtrag (Phase 3, 26.11.2026):** Das Repository `exyuzaaa/nova-ai` war bei der Analyse leer – es gab keinen
> bestehenden NOVA-Code, keine Auth-Lösung und keine Organisationstabellen. Deshalb wurde entschieden, NOVA auf dieser
> Basis neu aufzubauen: Supabase Auth (E-Mail/Passwort) ist die Anmeldung, `analytics.organizations` ist das
> Organisationsmodell. Die Spalte `nova_tenant_id` aus dem Entwurf entfällt. Das Schema liegt als Migrationen in
> `supabase/migrations/`, die Tests in `supabase/tests/`. Weitere Abweichungen: Mitglieder kommen nur per Einladung
> hinzu (kein direktes Einfügen), und Änderungen werden per Trigger im Audit-Log festgehalten.

## 0. Kurzfassung

- **Wichtig:** Das NOVA-AI-Repository war in dieser Sitzung **nicht erreichbar** (siehe §1). Dieser Plan ist deshalb so gebaut, dass er als eigenständiges Modul (`analytics`) in ein bestehendes Next.js-/Supabase-Projekt passt, ohne vorhandene Tabellen oder Routen zu berühren. Alle Stellen, die vom echten Repository abhängen, sind mit **⚠ PRÜFEN** markiert.
- **Kernentscheidung Datenhaltung:** Eigenes Tracking-Script → eigene Ingestion-API → Supabase/PostgreSQL (eigenes Schema `analytics`, monatlich partitioniert) → serverseitige Aggregate. PostHog wird **nicht** als Speicher für Kundendaten genutzt, sondern für Produktanalyse von NOVA selbst und Feature-Flags (Begründung §2.12).
- **Kernentscheidung Datenschutz:** Standardmodus ist **cookieless** (keine Speicherung auf dem Endgerät, täglich rotierender Besucher-Hash, keine IP-Speicherung). Wiederkehrende Besucher, tagesübergreifende Pfade und lückenlose Lead-Attribution gibt es nur **nach Einwilligung**. Die Oberfläche zeigt fehlende Kennzahlen ausdrücklich als „nicht verfügbar“ statt geschätzter Werte.
- **Schema ist getestet:** Der Entwurf wurde in einem lokalen PostgreSQL 16 mit Supabase-Stubs eingespielt. 28/28 Tests zu Mandantentrennung und Rollen sind grün (Details §3.4).

---

## 1. Bestandsaufnahme

### 1.1 Was geprüft wurde

| Quelle | Ergebnis |
|---|---|
| Arbeitsverzeichnis der Sitzung (`/home/user`) | leer, kein Git-Repository |
| GitHub-Repositories, die dieser Sitzung freigegeben sind | keine (auch keines mit „nova“ im Namen) |
| Freigegebene Ordner auf deinem Computer | keine |
| Supabase-Projekte des verbundenen Kontos | nur `lumen-events` – hat mit NOVA nichts zu tun und wurde nicht verändert |

**Folge:** Eine echte Analyse vorhandener Komponenten, Datenbankstrukturen, Auth-Lösung und des NOVA CRM war nicht möglich. Bevor Phase 2 beginnt, muss das Repository angebunden und die Bestandsaufnahme ergänzt werden.

### 1.2 Checkliste für die Repository-Analyse (wird nach Anbindung abgearbeitet)

| Bereich | Zu klären | Auswirkung auf diesen Plan |
|---|---|---|
| Projektstruktur | Monorepo (Turborepo/pnpm) oder einzelne Next.js-App? `src/`-Ordner? | Ordnerstruktur §4 (Tracker als eigenes Paket oder Unterordner) |
| Next.js-Version | App Router vorhanden? Version ≥ 15? | Caching-API (`use cache` vs. `unstable_cache`), Middleware/Proxy |
| Authentifizierung | Supabase Auth, NextAuth/Auth.js, Clerk oder eigene Lösung? | RLS mit `auth.uid()` funktioniert direkt nur mit Supabase Auth; sonst JWT-Bridge (§2.9) |
| Mandanten | Gibt es bereits `organizations`/`tenants`/`workspaces`? | Dann koppelt `analytics.organizations.nova_tenant_id` 1:1 daran, statt doppelte Mandanten zu führen |
| NOVA CRM | Gleiche Datenbank oder eigener Dienst? Tabellen `leads`, `contacts`, `appointments`? ID-Typen? Webhooks? | CRM-Adapter (§2.10), Typ von `lead_attributions.crm_lead_id` |
| Designsystem | shadcn/ui bereits installiert? Tailwind v3 oder v4? Vorhandene Tokens, Schriften, Theme-Umschaltung? | Phase 2 nutzt vorhandene Tokens weiter, statt neue zu erfinden |
| Datenbank-Migrationen | `supabase/migrations`, Prisma, Drizzle? | Form der Migrationsdateien |
| KI-Anbindung | Welcher Anbieter wird in NOVA-AI bereits genutzt? | Wiederverwendung des vorhandenen Clients/Abrechnung |
| E-Mail | Resend, Postmark, SMTP? | Versand der Berichte |
| Tests/CI | Vitest/Jest, Playwright, GitHub Actions? | Teststrategie §5 |
| Deployment | Vercel-Projekt, Domains, Umgebungen (Preview/Production)? | Tracking-Subdomain, Cron-Jobs |

---

## 2. Technische Zielarchitektur

### 2.1 Überblick

```
 Kunden-Website                         NOVA (Vercel, Next.js App Router)                      Daten
┌────────────────────┐   POST /api/e   ┌──────────────────────────────────┐
│ tracker.js (<3 KB) │ ──────────────▶ │ Ingestion (Edge Route Handler)   │── XADD ──▶ Upstash Redis
│ data-site-id=…     │   sendBeacon    │  · Validierung (Zod), Größenlimit │           · Event-Stream
│ novaAnalytics.track│                 │  · Rate Limit, Bot-Filter         │           · Sessions (TTL 30 min)
└────────────────────┘                 │  · UA → Kategorien, Geo-Header    │           · Echtzeit-Präsenz (ZSET)
                                       │  · IP nur im RAM → Hash, verworfen│           · Tages-Salt (TTL 48 h)
                                       └──────────────────────────────────┘
                                                                                   ▼ jede Minute (QStash/Vercel Cron)
                                       ┌──────────────────────────────────┐   Bulk-Insert
                                       │ Worker: flush-events             │ ─────────────▶ Supabase PostgreSQL
                                       │  · Sessions upserten              │               schema "analytics"
                                       │  · Ziele matchen → conversions    │               · events/sessions (partitioniert)
                                       └──────────────────────────────────┘               · hourly/daily Aggregate
                                       ┌──────────────────────────────────┐               · Ziele, Funnels, Leads …
 Dashboard-Nutzer ◀── RSC/HTML ──────  │ Dashboard (Server Components)     │ ◀── RLS ───── (nutzergebundener Client)
                                       │ Query-Layer (typisiert, gecacht)  │
                                       │ KI-Analyse (Tool-Use auf Query-L.)│ ──▶ Anthropic API (nur Aggregate)
                                       │ Berichte (PDF/CSV/XLSX, E-Mail)   │ ──▶ Resend · Supabase Storage
                                       │ CRM-Adapter                       │ ◀─▶ NOVA CRM
                                       └──────────────────────────────────┘
```

### 2.2 Architekturprinzipien

1. **Modul statt Umbau:** Alles liegt unter `src/modules/analytics`, `app/(analytics)/…`, `app/api/analytics/…` und im DB-Schema `analytics`. Bestehende Dateien werden nur an definierten Andockpunkten berührt (Navigation, Provider, ggf. Middleware) – jeweils als eigener, klar beschriebener Diff zur Freigabe.
2. **Eine Wahrheit für Kennzahlen:** Jede Kennzahl hat genau eine Definition in `domain/metrics.ts` (§2.6). Dashboard, Berichte, Exporte und KI nutzen denselben Query-Layer.
3. **Server-first:** Autorisierung, Aggregation und Formatierung laufen auf dem Server. Der Browser bekommt fertige, berechtigte Daten.
4. **Ehrliche Daten:** Keine geschätzten Werte ohne Kennzeichnung. Demo-Daten nur in Demo-Organisationen/-Websites (`is_demo = true`) mit dauerhaftem Banner „Demo-Daten“. Im Produktivmodus gibt es keinen Code-Pfad, der synthetische Daten erzeugt.
5. **Datensparsamkeit als Default:** Was nicht gebraucht wird, wird nicht erhoben (keine IP, keine Formularinhalte, keine vollständigen Query-Strings, keine Click-ID-Werte).

### 2.3 Tracking-Script (`tracker.js`)

**Einbindung**

```html
<script defer src="https://analytics.deinedomain.de/tracker.js" data-site-id="ns_xxxxxxxxxxxxxxxx"></script>
```

Optionale Attribute: `data-consent="cookieless|wait"`, `data-auto="pageview,outbound,downloads,forms,scroll,contact"`, `data-api="…"` (eigener Proxy-Pfad gegen Adblocker).

**Eigenschaften**

- TypeScript, gebündelt mit esbuild/tsup zu einer IIFE, Ziel < 3 KB gzip, keine Abhängigkeiten.
- Versand per `navigator.sendBeacon`, Fallback `fetch(…, { keepalive: true })`. Payload als `text/plain`, um CORS-Preflights zu vermeiden.
- **Automatisch:** Pageview, SPA-Navigation (Patch von `history.pushState/replaceState` + `popstate`, Duplikat-Schutz), Referrer, UTM-Parameter, Landingpage (serverseitig aus erster Session-Seite), Session-Start (serverseitig), Geräte/Browser (serverseitig aus User-Agent – im Script wird nichts ausgelesen).
- **Optional (pro Website schaltbar):** Scrolltiefe (25/50/75/100 %), Outbound-Klicks, Downloads (Dateiendungsliste), `tel:`/`mailto:`-Klicks, Formular-Start/-Absenden (nur `id`/`name`/`data-nova-form` des Formulars, **niemals Feldwerte**).
- **Engagement & Heartbeats:** Das Script misst aktive Zeit (Tab sichtbar *und* Interaktion in den letzten 30 s). Solange aktiv, sendet es alle 30 s (konfigurierbar) einen Heartbeat; beim Verlassen (`pagehide`/`visibilitychange`) ein `engagement`-Event mit der aktiven Zeit.
- **Öffentliche API:**

```js
window.novaAnalytics.track("contact_form_submitted", { form_name: "contact" });
window.novaAnalytics.consent("granted" | "denied");   // Brücke zu jeder CMP
window.novaAnalytics.optOut();                        // persistentes Opt-out (+ Löschauftrag bei consented_id)
window.novaAnalytics.getSessionRef();                 // signierte Session-Referenz für CRM-Formulare (nur mit Einwilligung)
```

  Aufrufe vor dem Laden werden über eine Stub-Queue gepuffert (`window.novaAnalytics = window.novaAnalytics || { q: [] }`).
- **Schutzmechanismen im Client:** Respektiert Global Privacy Control und Do-Not-Track (abschaltbar pro Website), ignoriert `localhost`, Vorschau-Umgebungen und Prerender, entfernt alle Query-Parameter außer UTM und Allowlist, ersetzt E-Mail-Adressen/Token-Muster im Pfad durch Platzhalter.

### 2.4 Ingestion

**Endpunkt:** `POST https://analytics.deinedomain.de/api/e` (Rewrite auf `app/api/analytics/collect/route.ts`, Edge Runtime, Region `fra1`).

Ablauf pro Request:

1. Größenlimit (16 KB), Schema-Validierung (Zod), max. 30 Properties, Strings ≤ 500 Zeichen.
2. `site_id` → Website-Konfiguration aus Redis-Cache (Fallback DB, TTL 60 s). Unbekannt/pausiert → `202` ohne Speicherung (keine Auskunft für Angreifer).
3. Origin/Hostname gegen erlaubte Domains prüfen.
4. Rate Limits (Upstash Ratelimit): pro Site+IP-Hash (z. B. 60 Events/10 s), pro Site (Plan-Kontingent), global.
5. Bot-Filter (User-Agent-Liste, Headless-Merkmale, fehlende Sprache usw.) → verworfen, nur Zähler erhöht.
6. Anreicherung: Gerätetyp/Browser/OS (ua-parser, nur Familien + Major-Version), Land/Region/Stadt aus Vercel-Geo-Headern (Granularität je Website), Kanal-Klassifikation (§2.5).
7. **Besucherkennung:**
   - *cookieless:* `visitor_hash = SHA-256(tages_salt ‖ pepper ‖ site_id ‖ IP ‖ User-Agent)`, gekürzt auf 16 Byte. Der Tages-Salt liegt nur in Redis und wird nach 48 h gelöscht → keine Wiedererkennung über Tage, keine Rückrechnung.
   - *nach Einwilligung:* Zufalls-ID aus First-Party-Storage, serverseitig mit Pepper gehasht.
   - Die IP existiert nur im Arbeitsspeicher des Requests und wird nie geschrieben oder geloggt.
8. **Session-Zuordnung:** Redis-Key `s:{site}:{visitor_hash}` mit TTL = Session-Timeout (Standard 30 min, jede Aktivität verlängert). Neue Session bei Ablauf oder neuer Kampagne (andere `utm_campaign`/`utm_source`).
9. Event in Redis-Stream (`XADD`), Echtzeit-Präsenz aktualisieren (§2.7), Antwort `202`.

**Worker `flush-events`** (jede Minute, QStash-Schedule, signiert): liest Batches aus dem Stream (Consumer Group), schreibt per Bulk-Insert in `analytics_events`, upsertet `analytics_sessions`, gleicht aktive Ziele ab (→ `conversion_events`, idempotent über `unique(goal_id, event_id)`), registriert neue Custom-Event-Namen (Kardinalitätsgrenze, z. B. 500 je Website), bestätigt die Stream-Einträge (`XACK`). Bei Redis-Ausfall schreibt die Ingestion direkt synchron in die DB (Degraded Mode, Monitoring-Alarm).

**Skalierungspfad:** PostgreSQL mit Monatspartitionen reicht nach Erfahrung für viele KMU-Mandanten bis in den Bereich einiger zehn Millionen Events pro Monat. Darüber wird der `EventStore` (Interface im Query-Layer) auf ClickHouse/Tinybird umgestellt, ohne UI-Änderungen. Diese Grenze wird mit Lasttests in Phase 12 gemessen statt angenommen.

### 2.5 Traffic-Kanäle

Regelbasierte, testbare Klassifikation in `domain/channels.ts` (Reihenfolge entscheidet):

| Kanal | Regel (vereinfacht) |
|---|---|
| Paid Search | `utm_medium` ∈ {cpc, ppc, paid, paidsearch} **oder** Click-ID gclid/msclkid, und Quelle ist Suchmaschine |
| Display | `utm_medium` ∈ {display, banner, cpm, programmatic} |
| Email | `utm_medium`/`utm_source` enthält email/e-mail/newsletter |
| Social | Referrer/`utm_source` in Social-Liste (facebook, instagram, linkedin, x/t.co, xing, tiktok, youtube, pinterest …) – bezahlt mit `utm_medium` paid_social → ebenfalls Social |
| Organic Search | Referrer in Suchmaschinenliste (google, bing, duckduckgo, ecosia, yahoo, startpage, qwant …) ohne Paid-Merkmal |
| Referral | sonstiger externer Referrer |
| Direct | kein Referrer, keine UTM-Parameter |
| Unassigned | UTM-Parameter vorhanden, aber keiner Regel zuordenbar |

Die Quelllisten liegen versioniert im Code und sind per Unit-Test abgedeckt.

### 2.6 Kennzahlen-Definitionen (verbindlich)

| Kennzahl | Definition |
|---|---|
| Eindeutige Besucher | Anzahl unterschiedlicher `visitor_hash` im Zeitraum. **Cookieless:** pro Tag eindeutig; über mehrere Tage wird dieselbe Person je Tag neu gezählt – die UI weist darauf hin. |
| Sessions | Folge von Events eines Besuchers ohne Pause > Session-Timeout (Standard 30 min) bzw. bis Kampagnenwechsel |
| Seitenaufrufe | Anzahl `pageview`-Events |
| Neue / wiederkehrende Besucher | Nur mit `consented_id` bestimmbar. Neu = erste Session dieser ID überhaupt. Ohne Einwilligung: „nicht verfügbar“ (kein Schätzwert) |
| Ø Sitzungsdauer | Summe aktiver Engagement-Zeit (Heartbeats/Engagement-Events) ÷ Sessions – keine „Zeit bis zum letzten Klick“ |
| Absprungrate | Anteil Sessions mit genau einem Seitenaufruf, < 10 s Engagement und keiner Conversion |
| Conversion Rate | Sessions mit ≥ 1 Conversion (gewählte Ziele) ÷ Sessions |
| Generierte Leads | Anzahl `lead_attributions` (aus dem CRM bestätigte Leads) im Zeitraum – unterscheidet sich bewusst von „Formular abgeschickt“ |
| Einstiege / Ausstiege | Sessions, deren erste / letzte Seite die URL ist |
| Engagement-Zeit je Seite | Summe aktiver Zeit auf der Seite ÷ Seitenaufrufe |
| Zeitraumvergleich | Gleich langer, unmittelbar vorangehender Zeitraum (wahlweise Vorjahr); Delta absolut und relativ |

### 2.7 Echtzeit

- **Präsenz:** Redis Sorted Set `rt:{site}:visitors` (Member = `visitor_hash`, Score = letzter Kontakt). *Aktiv* = Signal in den letzten 90 s (3 Heartbeat-Intervalle); zusätzlich „letzte 30 Minuten“. Alte Einträge werden bei jedem Schreiben per `ZREMRANGEBYSCORE` entfernt.
- **Live-Zähler:** Minuten-Buckets in Redis (`rt:{site}:pv:{minute}` usw., TTL 2 h) für Seitenaufrufe, neue Sessions und Events; Kurzlisten für aktuelle Seiten, Quellen, Länder und Geräte als Hashes mit TTL.
- **Auslieferung:** Server-Sent Events (`app/api/analytics/realtime/[siteId]/route.ts`), Push alle 5 s, Fallback Polling. Kein Supabase Realtime auf Rohdaten (zu teuer, RLS-Last).
- **Session-Abschluss:** Job `close-sessions` (jede Minute) setzt `closed_at`, `exit_path`, `is_bounce` für Sessions ohne Aktivität > Timeout.

### 2.8 Aggregation, Abfragen, Caching

- **`analytics_hourly`** (UTC, Gesamtwerte) – Job alle 5 Minuten für die laufende und vorige Stunde.
- **`analytics_daily`** (Tag in Zeitzone der Website, je Dimension) – stündlich für „heute“, nächtlicher Abschluss für „gestern“, Backfill-Funktion für Neuberechnungen (z. B. nach neuem Ziel).
- Rollups als SQL-Funktionen (`analytics.rollup_hourly`, `analytics.rollup_daily`), idempotent per `insert … on conflict do update`, geplant mit **pg_cron** (läuft in der DB, ohne HTTP-Overhead). Jobs, die Node brauchen (PDF, E-Mail, CRM-Sync), laufen über **QStash/Vercel Cron**.
- **Query-Layer** (`server/queries/*`): typisierte Funktionen wie `getOverview(siteId, range, filters)`, `getTimeseries`, `getBreakdown(dimension)`, `comparePeriods`, `getFunnel`, `getGoalStats`. Sie wählen automatisch die Quelle: Aggregate für additive Werte, `analytics_sessions` für zeitraumübergreifende Unique-Visitors, Rohdaten nur für Pfade/Funnels.
- **Caching:** Ergebnisse in Redis, Schlüssel = Hash aus (Website, Abfrage, Zeitraum, Filter, Datenstand). TTL 60 s für Zeiträume mit „heute“, 24 h für abgeschlossene Zeiträume; Invalidierung über Versionszähler je Website nach Rollups.
- **Pagination:** Cursor-basiert (Keyset auf `(wert, dimension_value)`) für alle Tabellen, Standard 25, max. 500 Zeilen; Exporte streamen.

### 2.9 Authentifizierung, Mandanten, Rollen

- **Auth:** Wiederverwendung der vorhandenen NOVA-Anmeldung. ⚠ PRÜFEN: Mit Supabase Auth greift RLS direkt. Mit einer anderen Lösung (NextAuth/Clerk) wird serverseitig ein kurzlebiges, von Supabase akzeptiertes JWT (gleiches `sub`) signiert oder die Abfragen laufen ausschließlich über die Service-Rolle **mit** verpflichtender serverseitiger Prüfung – dann entfällt RLS als zweite Verteidigungslinie, was ich nicht empfehle.
- **Datenräume:** Jede Zeile mit Analytics-Daten trägt `website_id` (und bei Rohdaten zusätzlich `organization_id`). RLS-Policies lassen nur Websites zu, die `analytics.accessible_website_ids(rolle)` für den angemeldeten Nutzer liefert.
- **Serverseitige Autorisierung (zusätzlich zu RLS):** Jede Server Action / Route nutzt `requireSiteAccess(siteId, minRole)` bzw. `requireOrgRole(orgId, minRole)`; die öffentliche Tracking-ID ist **kein** Berechtigungsnachweis.
- **Rollenmatrix:**

| Recht | Viewer | Analyst | Admin | Owner |
|---|:-:|:-:|:-:|:-:|
| Dashboards, Berichte ansehen | ✓ | ✓ | ✓ | ✓ |
| Eigene Dashboard-Layouts | ✓ | ✓ | ✓ | ✓ |
| Exporte (CSV/XLSX/PDF) | ✓¹ | ✓ | ✓ | ✓ |
| Ziele, Funnels, Kampagnen, Berichtsvorlagen, Org-Dashboards | – | ✓ | ✓ | ✓ |
| Leads-Ansicht (CRM-Bezug) | – | ✓ | ✓ | ✓ |
| KI-Analyse nutzen (wenn aktiviert) | ✓¹ | ✓ | ✓ | ✓ |
| Websites, Tracking-Einstellungen, Integrationen, API-Schlüssel | – | – | ✓ | ✓ |
| Mitglieder einladen / Rollen bis Admin vergeben | – | – | ✓ | ✓ |
| Audit-Log, Einwilligungsnachweise, Löschaufträge | – | – | ✓ | ✓ |
| Owner ernennen, KI aktivieren, White-Label, Organisation löschen | – | – | – | ✓ |

¹ pro Organisation abschaltbar.

- **Agenturen:** Mitglieder können auf einzelne Websites beschränkt werden (`organization_member_websites`). White-Label-Einstellungen in `organization_branding`.

### 2.10 NOVA-CRM-Integration

⚠ PRÜFEN: Form hängt davon ab, ob das CRM in derselben Datenbank liegt.

- **Zuordnung mit Einwilligung:** Das Formular übergibt `novaAnalytics.getSessionRef()` (HMAC-signiert, 24 h gültig) als verstecktes Feld. Das CRM speichert die Referenz am Lead; ein Hook ruft `attributeLead(leadId, sessionRef)` auf.
- **Zuordnung ohne Einwilligung (cookieless):** Der serverseitige Formular-Handler des CRM ruft `attributeLeadFromRequest(leadId, siteId, request)` auf. Aus IP + User-Agent des **laufenden** Requests wird derselbe Tages-Hash berechnet und die aktuelle Session gefunden – ohne IP zu speichern und ohne Speicherung auf dem Endgerät. Funktioniert nur für Leads am selben Tag und im selben Browser; die UI zeigt die Zuordnungsquote ehrlich an.
- **Statusverlauf:** CRM-Ereignisse (Lead qualifiziert, Termin gebucht, Kunde geworden, Auftragswert) fließen per Datenbank-Trigger oder signiertem Webhook (`/api/analytics/integrations/nova-crm/webhook`) in `lead_attributions`.
- **Auswertungen:** Leads und Kunden je Kanal/Quelle/Kampagne/Landingpage, Terminbuchungsrate, Kosten pro Lead (mit `campaign_costs`), Lead-zu-Kunde-Rate. Kontaktdaten werden **nicht** nach Analytics kopiert; die Leads-Ansicht verlinkt in das CRM.
- **Attributionsmodelle:** last non-direct (Standard), first touch und last touch – first touch nur mit Einwilligung sinnvoll.

### 2.11 KI-Analyse (optional, standardmäßig aus)

- **Oberfläche:** Ein dezentes „Fragen“-Feld (⌘K-Dialog bzw. Seitenleiste), kein eigener Navigationspunkt, keine KI-Optik. Owner schaltet es pro Organisation frei.
- **Modell:** Anthropic API, `claude-opus-5-5` (per `ANALYTICS_AI_MODEL` änderbar), Tool-Use über das TypeScript-SDK, Antworten gestreamt.
- **Kein SQL-Zugriff für das Modell:** Das Modell bekommt nur feste, typisierte Werkzeuge (`get_overview`, `get_timeseries`, `get_breakdown`, `compare_periods`, `get_goal_stats`, `get_funnel`, `get_campaign_performance`, `get_lead_attribution`, `explain_change`). Jedes Werkzeug läuft durch denselben Query-Layer mit der Berechtigung **des fragenden Nutzers**; Website-IDs werden serverseitig eingeschränkt.
- **Keine erfundenen Zahlen:** Nach der Antwort extrahiert ein Prüfer alle Zahlen und gleicht sie mit den Werkzeugergebnissen ab (inkl. gerundeter und prozentualer Ableitungen). Nicht belegte Zahlen werden markiert und in `ai_query_logs.unverified_numbers` protokolliert. Ohne Werkzeugdaten antwortet die KI „dazu liegen keine Daten vor“.
- **Keine unbelegten Kausalitäten:** `explain_change` liefert eine Zerlegung („Rückgang −1.240 Besuche, davon −980 aus Organic Search, überwiegend Seite /preise“). Der System-Prompt verlangt, Zusammenhänge als Beobachtung zu formulieren, Ursachen nur als Hypothesen zu kennzeichnen und fehlende Daten zu benennen.
- **Datenschutz:** An das Modell gehen nur Aggregate, keine Lead-Kontaktdaten, keine Visitor-Hashes. Auftragsverarbeitungsvertrag mit Anthropic erforderlich; Anfragen werden 90 Tage protokolliert (Audit).

### 2.12 Rolle von PostHog

Empfehlung: **PostHog EU Cloud (Frankfurt) nur für NOVA selbst** – Produktanalyse des Dashboards (welche Berichte genutzt werden), Feature-Flags für schrittweise Freischaltung (z. B. KI, neue Ingestion) und Session-Replays **ohne** Kundendaten (Maskierung aller Zahlen und Tabellen). Optional zusätzlich als **Integration**: Kunden können ihre Events an ihr eigenes PostHog-Projekt weiterleiten lassen. Kundendaten werden nicht in einem NOVA-PostHog-Konto gespeichert, weil das eine zweite Datenhaltung mit eigenen Löschfristen bedeutet.

### 2.13 Berichte & Exporte

- **Vorlagen** (`report_definitions.template`, Zod-validiert): Abschnitte wie KPI-Übersicht, Zeitreihe, Top-Seiten, Kanäle, Ziele, Funnels, Kampagnen, Leads, Freitext.
- **Formate:** PDF mit `@react-pdf/renderer` (Diagramme als serverseitig erzeugtes SVG, kein Headless-Browser), CSV gestreamt, XLSX mit `exceljs`. White-Label: Logo, Farbe, Fußzeile, Absendername.
- **Versand:** Job `reports-dispatch` (alle 15 min) sucht fällige Berichte (`next_run_at`), erzeugt Dateien in einem privaten Supabase-Storage-Bucket, versendet per Resend mit signierten, ablaufenden Links (Anhang optional bis 10 MB). `unique(report_id, period_start, period_end)` verhindert Doppelversand.
- Jeder Export wird im Audit-Log festgehalten.

### 2.14 Datenschutz & Sicherheit

| Thema | Umsetzung |
|---|---|
| TDDDG § 25 | Cookieless-Modus ohne Speicher-/Lesezugriff auf dem Endgerät; persistente ID erst nach Einwilligung. `consent_required` erfasst ohne Einwilligung gar nichts |
| DSGVO Rechtsgrundlage | Cookieless: berechtigtes Interesse (Art. 6 Abs. 1 lit. f) – **juristisch zu bestätigen**; mit ID: Einwilligung |
| Consent Management | Eigener schlanker Banner optional; Brücken für gängige CMPs über `novaAnalytics.consent()`; Nachweise in `consent_records` (ohne IP) |
| Datenminimierung | Keine IP, keine Formularinhalte, Query-Allowlist, Click-IDs nur als Typ, Stadt nur auf Wunsch, PII-Scanner für Custom-Props (E-Mail, Telefon, IBAN → verworfen + Warnung im UI) |
| Aufbewahrung | Rohdaten Standard 13 Monate (30–1.095 Tage einstellbar), Aggregate unbegrenzt oder einstellbar, KI-Logs 90 Tage, Einwilligungsnachweise 3 Jahre; nächtlicher Löschjob + Partition-Drops |
| Betroffenenrechte | Löschauftrag pro `consented_id`, Website, Organisation oder Zeitraum (`data_deletion_requests`); cookieless-Daten sind nach Salt-Löschung keiner Person mehr zuordenbar |
| Mandantentrennung | RLS + serverseitige Prüfung + automatisierte Tests (§3.4) |
| Geheimnisse | Alle Schlüssel nur serverseitig (Vercel Env), Integrations-Secrets in Supabase Vault, API-Schlüssel nur als SHA-256 |
| Abuse | Rate Limits auf Ingestion, Dashboard-API, Exporte, KI; Payload-Limits; Kardinalitätsgrenzen |
| Härtung | CSP, keine Inline-Skripte im Dashboard, CSRF-Schutz für Server Actions (Origin-Prüfung), Audit-Log append-only |
| Hosting | Supabase-Region `eu-central-1`, Vercel-Funktionen in `fra1`, Auftragsverarbeitungsverträge mit Supabase, Vercel, Upstash, Resend, Anthropic, PostHog |

Hinweis: Diese Punkte sind technische Maßnahmen, keine Rechtsberatung. Vor dem Produktivstart sollte eine Datenschutzprüfung (inkl. Verzeichnis der Verarbeitungstätigkeiten, ggf. DSFA) erfolgen.

### 2.15 Monitoring

- Ingestion-Kennzahlen in Redis (angenommen/verworfen/Bot/Rate-limited, Stream-Länge, Flush-Verzögerung), Seite „Systemstatus“ für Admins, Health-Endpoint für externe Überwachung.
- Alarme: Flush-Verzögerung > 5 min, Fehlerquote Ingestion > 1 %, fehlende künftige Partition, fehlgeschlagene Berichte.
- Fehler-Tracking mit Sentry (optional), Vercel Observability, Supabase Advisors (Sicherheit/Performance) als fester Schritt in jeder Phase.

### 2.16 Designsystem (Phase 2)

- shadcn/ui + Tailwind, Tokens als CSS-Variablen auf `:root` und `.dark`; Light Theme Standard, Dark Theme vollständig (`next-themes`, Systemeinstellung respektiert).
- Neutrale Graustufen, **eine** Akzentfarbe, validierte Diagrammpalette mit ausreichendem Kontrast in beiden Themes; Deltas nie nur über Farbe (Pfeil + Vorzeichen + Text).
- Schrift: Geist oder Inter (⚠ PRÜFEN: vorhandene NOVA-Schrift übernehmen), `tabular-nums` für Zahlen.
- Komponenten: `KpiCard` (Wert, Delta, Sparkline), `TimeseriesChart` (Vorperiode gestrichelt), `BreakdownTable` (Balken in der Zeile), `DateRangePicker` mit Vergleich, `SiteSwitcher`, `FilterBar`, `EmptyState`, `DataNotice` (z. B. „Ohne Einwilligung nicht verfügbar“), `DemoBanner`.
- Barrierearmut: Tastaturbedienung, sichtbarer Fokus, Diagramme mit Tabellen-Alternative und `aria`-Beschreibung, Kontrast WCAG 2.2 AA, `prefers-reduced-motion`.

---

## 3. Datenbankschema

### 3.1 Grundsätze

- Eigenes Schema **`analytics`** → keine Namenskonflikte mit bestehenden NOVA-Tabellen.
- UUIDs als Schlüssel, `timestamptz` überall, Geldbeträge in Cent (`bigint`).
- Rohdaten (`analytics_events`, `analytics_sessions`) monatlich nach Zeit partitioniert; Aufbewahrung über Partition-Drops (billig) plus zeilenweises Löschen bei kürzeren Fristen.
- Schreibende Rohdaten-Zugriffe nur über `service_role`; Nutzer lesen per RLS.

### 3.2 Tabellenübersicht

| Bereich | Tabelle | Zweck |
|---|---|---|
| Mandanten | `organizations` | Unternehmen, Plan, KI-Schalter, Demo-Kennzeichen, Kopplung an NOVA-Mandant |
| | `organization_branding` | White-Label |
| | `organization_members` | Nutzer ↔ Organisation mit Rolle |
| | `organization_invitations` | Einladungen (nur Token-Hash) |
| | `organization_member_websites` | optionale Website-Beschränkung je Mitglied |
| Websites | `websites` | Websites, öffentliche Tracking-ID `ns_…`, Zeitzone, Demo-Kennzeichen |
| | `tracking_settings` | Modus, Auto-Tracking, Ausschlüsse, Aufbewahrung, Timeout |
| | `api_keys` | serverseitige Schlüssel (Hash) |
| Datenschutz | `consent_records` | Einwilligungsnachweise |
| | `data_deletion_requests` | Löschaufträge |
| Rohdaten | `analytics_events` | alle Events (partitioniert) |
| | `analytics_sessions` | Sessions inkl. Einstieg/Ausstieg/Kanal (partitioniert) |
| Aggregate | `analytics_hourly` | Gesamtwerte je Stunde |
| | `analytics_daily` | Werte je Tag und Dimension |
| Marketing | `campaigns`, `campaign_costs` | Kampagnen, Budgets, Kosten |
| Events & Ziele | `custom_events` | Register der Event-Namen |
| | `conversion_goals` | Zieldefinitionen (Event, Seite, Klick, Formular …) |
| | `conversion_events` | erreichte Ziele inkl. Attribution |
| Funnels | `funnel_definitions`, `funnel_steps` | mehrstufige Funnels (max. 10 Schritte) |
| CRM | `lead_attributions` | Lead ↔ Session/Kanal/Kampagne, CRM-Status |
| Berichte | `report_definitions`, `report_runs` | Vorlagen, Zeitpläne, Läufe |
| Dashboards | `dashboard_layouts` | konfigurierbare Dashboards |
| Integrationen | `analytics_integrations` | NOVA CRM, PostHog, Search Console, Slack, Webhook |
| Betrieb | `ai_query_logs`, `audit_logs` | KI-Protokoll, unveränderliches Audit-Log |

Alle Felder, Indizes, Constraints und Policies: siehe `schema-entwurf.sql`.

### 3.3 Wichtige Indizes

- `analytics_events (website_id, occurred_at desc)`, `(website_id, event_name, occurred_at desc)`, `(session_id)`
- `analytics_sessions (website_id, started_at desc)`, `(website_id, visitor_hash, started_at desc)`, Teilindex für offene Sessions
- `analytics_daily` PK `(website_id, day, dimension, dimension_value)` + `(website_id, dimension, day desc)`
- `conversion_events (website_id, occurred_at desc)`, `(goal_id, occurred_at desc)`

### 3.4 Validierung des Entwurfs

Eingespielt in PostgreSQL 16 mit Supabase-Stubs (`tests/supabase-stub.sql`); Ergebnis von `tests/rls-mandantentrennung.test.sql`: **28 von 28 Prüfungen bestanden**, u. a.:

- Owner A sieht nur Daten von Org A, Owner B nur von Org B; keine fremden Websites/Einstellungen lesbar oder änderbar.
- Viewer kann keine Ziele anlegen und sich nicht selbst befördern; Analyst kann Ziele nur auf freigegebenen Websites anlegen; niemand außer `service_role` schreibt Rohdaten.
- Admin kann keine Owner ernennen oder entfernen; letzter Owner ist geschützt.
- `anon` hat keinerlei Zugriff; Audit-Log ist auch für `service_role` unveränderlich.
- Aufbewahrungsfrist löscht nur Daten der betroffenen Website; Löschen einer Organisation kaskadiert.

Ein Fehler wurde dabei gefunden und behoben (Owner-Schutz blockierte das Kaskadenlöschen einer Organisation). Noch nicht getestet: Rollup-Funktionen (entstehen in Phase 5) und das Verhalten mit echtem Supabase (Phase 3, Supabase-CLI lokal).

---

## 4. Ordnerstruktur (Vorschlag)

⚠ PRÜFEN: Pfade werden an die vorhandene Struktur angepasst (z. B. ohne `src/`, oder `packages/` im Monorepo).

```
app/
  (analytics)/analytics/
    layout.tsx                    # Shell: Sidebar, Website-Wechsler, Zeitraum, Theme
    page.tsx                      # → zuletzt genutzte Website
    onboarding/                   # Website anlegen, Snippet, Installationsprüfung
    compare/                      # Website-Vergleich
    [siteId]/
      page.tsx                    # 1  Dashboard
      realtime/                   # 2  Echtzeit
      visitors/                   # 3  Besucher
      pages/                      # 4  Seitenanalyse
      sources/                    # 5  Traffic-Quellen
      locations/                  # 6  Länder und Regionen
      devices/                    # 7  Geräte und Browser
      paths/                      # 8  Besucherpfade
      events/                     # 9  Events
      goals/                      # 10 Conversion-Ziele
      funnels/                    # 11 Conversion-Funnels
      campaigns/                  # 12 Kampagnen
      leads/                      # 13 Leads
      reports/                    # 14 Berichte
      integrations/               # 15 Integrationen
      privacy/                    # 16 Datenschutz
      settings/                   # 17 Einstellungen (Website, Tracking, Mitglieder, Branding)
  api/analytics/
    collect/route.ts              # Ingestion (Edge, öffentlich)
    tracker/route.ts              # liefert tracker.js mit Cache-Headern
    realtime/[siteId]/route.ts    # SSE
    export/[siteId]/route.ts      # CSV/XLSX-Stream
    ai/route.ts                   # KI-Fragen (Streaming)
    integrations/nova-crm/webhook/route.ts
    jobs/                         # QStash/Cron-Endpunkte (signiert)
      flush-events/route.ts
      close-sessions/route.ts
      reports-dispatch/route.ts
      crm-sync/route.ts
src/modules/analytics/
  domain/                         # reine Logik, ohne I/O – vollständig unit-getestet
    metrics.ts  channels.ts  sessions.ts  user-agent.ts  pii-scrubber.ts
    goal-matcher.ts  funnel.ts  date-ranges.ts  permissions.ts
  server/
    auth/                         # requireSiteAccess, requireOrgRole
    db/                           # Supabase-Clients (user-scoped / service), generierte Typen
    ingestion/                    # validate, enrich, visitor-id, session-store, stream
    queries/                      # Query-Layer (overview, timeseries, breakdown, funnels …)
    cache/                        # Redis-Cache, Versionierung
    realtime/                     # Präsenz, Minuten-Buckets
    crm/                          # CRM-Adapter-Interface + NOVA-Implementierung
    reports/                      # Vorlagen, PDF/CSV/XLSX, Versand
    ai/                           # Werkzeuge, Prompt, Zahlenprüfer
    audit.ts  rate-limit.ts
  ui/
    components/                   # KpiCard, TimeseriesChart, BreakdownTable, FilterBar …
    charts/                       # Recharts-Wrapper mit Theme-Tokens
    views/                        # eine View je Navigationspunkt
  config/                         # Navigation, Ziel-Vorlagen, Kanal-Listen
tracker/                          # eigenständiges Build-Ziel (oder packages/tracker)
  src/index.ts  src/spa.ts  src/auto-events.ts  src/consent.ts
  test/                           # Vitest (jsdom) + Größen-Budget
supabase/
  migrations/2026xxxx_analytics_*.sql
  tests/analytics_*.test.sql      # pgTAP: RLS, Mandantentrennung, Aufbewahrung
tests/
  e2e/analytics/                  # Playwright: Fixture-Websites (statisch + SPA), Dashboard-Flows
  integration/analytics/          # gegen lokales Supabase + Redis
docs/analytics/
  ARCHITEKTUR.md  TRACKING.md  INTEGRATIONEN.md  DATENSCHUTZ.md  BETRIEB.md
```

---

## 5. Entwicklungsplan

Jede Phase endet mit: grünen Tests, `tsc --noEmit`, Lint, Supabase-Advisor-Check, kurzer Demo und deiner Freigabe. Bestehende Funktionen werden nur über explizit genannte Andockpunkte berührt.

| Phase | Inhalt | Ergebnis / Abnahmekriterien | Tests |
|---|---|---|---|
| **1 Architektur** *(dieses Dokument)* | Bestandsaufnahme, Zielarchitektur, Schema, Struktur, Plan, Env-Liste | Freigabe durch dich; Repo angebunden und Bestandsaufnahme §1.2 ergänzt | Schema-/RLS-Tests (erledigt, 28/28) |
| **2 Designsystem & Dashboard** | Tokens (Light/Dark), Shell mit 17 Navigationspunkten, Kernkomponenten, Dashboard-View gegen das Query-Layer-Interface; Datenquelle in dieser Phase ausschließlich eine **gekennzeichnete Demo-Organisation** | Dashboard vollständig bedienbar, beide Themes, mobil nutzbar, Demo-Banner sichtbar; Navigationspunkte ohne Funktion sind ausgeblendet statt als Platzhalter gezeigt | Komponenten-Tests, axe-Accessibility-Checks, visuelle Snapshots |
| **3 Auth & Mandanten** | Migration `analytics`-Schema, Organisationen, Mitglieder, Einladungen, Rollen, Website-Anlage mit Tracking-ID, Andockung an NOVA-Auth | Nutzer legt Organisation/Website an, lädt Mitglieder ein; Rechte greifen | pgTAP-RLS-Suite (aus §3.4 portiert), Server-Autorisierungs-Tests, E2E Einladung |
| **4 Tracking & Ingestion** | `tracker.js`, Collect-Endpunkt, Validierung, Bot-Filter, Rate Limits, Redis-Stream, Flush-Worker, Partitionen, Installationsprüfung im Onboarding | Events einer Test-Website erscheinen < 2 min in der DB; Script < 3 KB gzip | Tracker-Unit-Tests (SPA, Consent, PII), Ingestion-Integrationstests, E2E mit Fixture-Websites, Lasttest-Baseline |
| **5 Sessions & Aggregation** | Session-Logik, Session-Abschluss, Kanal-Klassifikation, Rollup-Funktionen, pg_cron, Query-Layer, Cache; Dashboard auf echte Daten umgestellt | Dashboard zeigt echte Werte; Kennzahlen stimmen mit Rohdaten-Nachrechnung überein | Golden-Dataset-Tests: bekannter Event-Strom → erwartete Kennzahlen |
| **6 Echtzeit & Besucher** | Präsenz, Heartbeats, SSE, Echtzeit-Seite, Besucher-Seite (neu/wiederkehrend, Sitzungsdauer, Absprungrate) | Aktive Besucher fallen nach Timeout korrekt weg | Zeitgesteuerte Tests mit Fake-Clock |
| **7 Traffic & Seiten** | Quellen, Kanäle, UTM, Länder/Regionen, Geräte/Browser, Seitenanalyse (Einstiege, Ausstiege, Engagement, Conversions), Besucherpfade | Alle Tabellen paginiert, filterbar, exportierbar | Klassifikations-Tests, Query-Tests |
| **8 Conversion-Tracking** | Ziele mit Vorlagen (Kontaktformular, Telefon, Termin, Anfrage, Chatbot, Registrierung, Kauf), Matching, Backfill, Events-Seite | Neues Ziel rückwirkend berechnet (innerhalb Aufbewahrung) | Conversion-Tests (Idempotenz, once-per-session, Regex-Grenzen) |
| **9 Funnels & CRM** | Funnel-Editor, Berechnung, Zeitraumvergleich; CRM-Adapter, Lead-Attribution, Kampagnen inkl. Kosten, Leads-Seite | Funnel mit 2–10 Schritten; Leads je Kampagne/Quelle; Zuordnungsquote sichtbar | Funnel-Golden-Tests, CRM-Webhook-Signatur, Attributions-Tests |
| **10 Berichte & Exporte** | Vorlagen, PDF/CSV/XLSX, Zeitpläne, E-Mail-Versand, White-Label, konfigurierbare Dashboards, Website-Vergleich | Wochenbericht kommt pünktlich und einmalig an | Snapshot-Tests der Dateien, Scheduler-Tests |
| **11 KI-Analyse** | Werkzeuge, System-Prompt, Zahlenprüfer, Opt-in, Protokoll | Beispielfragen aus dem Briefing korrekt beantwortet; nicht belegte Zahlen werden markiert | Eval-Set mit erwarteten Antworten, Tests auf Berechtigungsgrenzen |
| **12 Sicherheit, Datenschutz, Tests** | Pen-Test-Checkliste, Löschkonzept, Consent-Banner/CMP-Brücken, Datenschutzseite, Lasttests, Dokumentation | Keine offenen Advisor-Warnungen; Datenschutz-Doku vollständig | Datenschutztests (keine IP gespeichert, kein Storage vor Einwilligung, PII-Filter), Mandantentrennung unter Last |
| **13 Deployment** | Vercel-Konfiguration, Subdomain, Env, Cron/QStash, Monitoring, Runbook, Rollout per Feature-Flag | Produktivbetrieb für erste Website | Smoke-Tests gegen Production |

### Testarten im Überblick

| Art | Werkzeug | Schwerpunkt |
|---|---|---|
| Unit | Vitest | `domain/*`, Tracker, Zahlenprüfer |
| Integration | Vitest + lokales Supabase (CLI/Docker) + Redis | Ingestion → DB → Rollups → Queries |
| Datenbank | pgTAP (`supabase test db`) | RLS, Rollen, Mandantentrennung, Aufbewahrung |
| E2E | Playwright | Fixture-Websites (statisch + SPA) → Dashboard |
| Tracking | Playwright + jsdom | SPA-Wechsel, Consent-Verhalten, Beacon beim Verlassen |
| Datenschutz | Playwright + SQL-Prüfungen | kein Cookie/Storage vor Einwilligung, keine IP in DB/Logs, PII-Filter |
| Last | k6 | Ingestion-Durchsatz, Flush-Verzögerung |

---

## 6. API-Schlüssel & Umgebungsvariablen

„Öffentlich“ = darf im Browser landen (`NEXT_PUBLIC_…`). Alles andere ausschließlich serverseitig in Vercel.

| Variable | Pflicht | Öffentlich | Zweck / Bezugsquelle |
|---|:-:|:-:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | Supabase-Projekt-URL (vermutlich bereits in NOVA vorhanden) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (bzw. Publishable Key) | ✓ | ✓ | Nutzergebundener Client, durch RLS geschützt |
| `SUPABASE_SERVICE_ROLE_KEY` (bzw. Secret Key) | ✓ | – | Ingestion-Worker, Jobs – **nie** im Client |
| `SUPABASE_DB_URL` | CI | – | Migrationen/pgTAP in CI |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | ✓ | – | Event-Stream, Sessions, Echtzeit, Cache, Rate Limits (Upstash, Region eu-central-1) |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | ✓ | – | Minütliche Jobs und deren Signaturprüfung |
| `CRON_SECRET` | ✓ | – | Schutz der Vercel-Cron-Endpunkte |
| `ANALYTICS_HASH_PEPPER` | ✓ | – | Geheimer Zusatz für Besucher-Hashes (≥ 32 Byte, zufällig) |
| `ANALYTICS_SESSION_REF_SECRET` | ✓ | – | HMAC für `getSessionRef()` (CRM-Zuordnung) |
| `NEXT_PUBLIC_ANALYTICS_COLLECT_URL` | ✓ | ✓ | z. B. `https://analytics.deinedomain.de` |
| `ANTHROPIC_API_KEY` | nur KI | – | KI-Analyse (Anthropic Console) |
| `ANALYTICS_AI_MODEL` | – | – | Standard `claude-opus-5-5` |
| `RESEND_API_KEY`, `REPORTS_FROM_EMAIL` | nur Berichte | – | Berichtsversand (oder vorhandener NOVA-Mailanbieter) |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | optional | ✓ | Produktanalyse von NOVA selbst (`https://eu.i.posthog.com`) |
| `POSTHOG_PERSONAL_API_KEY` | optional | – | nur für serverseitige Feature-Flag-Auswertung |
| `NOVA_CRM_API_URL`, `NOVA_CRM_API_KEY`, `NOVA_CRM_WEBHOOK_SECRET` | ⚠ PRÜFEN | – | nur falls das CRM ein eigener Dienst ist; bei gleicher DB entfallen sie |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | optional | DSN ✓ | Fehler-Tracking |
| `MAXMIND_LICENSE_KEY` | optional | – | Geo-IP nur falls nicht auf Vercel betrieben (Vercel liefert Geo-Header) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | später | – | Integration Google Search Console |

Externe Konten, die angelegt bzw. geprüft werden müssen: Supabase (vorhanden?), Upstash (Redis + QStash), Vercel (Domain `analytics.…`), Resend, Anthropic, optional PostHog EU und Sentry. Jede Integration wird in `docs/analytics/INTEGRATIONEN.md` mit Zweck, Datenfluss, Region und AVV-Status dokumentiert.

---

## 7. Entscheidungen, die ich von dir brauche

1. **Repository-Zugang:** Name des Repos auf GitHub (`owner/repo`), damit ich es dieser Sitzung hinzufügen und die Bestandsaufnahme nachholen kann.
2. **Standard-Tracking-Modus:** Empfehlung `cookieless` als Standard, `consent_upgrade` pro Website zuschaltbar. Einverstanden?
3. **Redis-Puffer ab Phase 4** (empfohlen, robuster bei Lastspitzen) oder zunächst direkte DB-Inserts und Redis erst bei Bedarf?
4. **PostHog-Rolle** wie in §2.12 (nur NOVA-intern + optionale Weiterleitung)?
5. **Tracking-Domain:** Welche Domain soll `analytics.…` werden?
6. **E-Mail-Anbieter:** Resend oder vorhandener NOVA-Anbieter?

---

## 8. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Unbekannte Bestandsstruktur (Auth, CRM, Mandanten) | Repo-Analyse vor Phase 2; Andockpunkte als separate, freigegebene Diffs |
| Rechtliche Bewertung des cookieless-Modus | juristische Prüfung vor Produktivstart; `consent_required` als sichere Alternative |
| Wachstum der Rohdaten | Partitionierung, Aufbewahrung, Lasttests, vorbereiteter Wechsel des `EventStore` |
| Adblocker blockieren `tracker.js` | First-Party-Proxy-Pfad auf der Kundendomain dokumentieren |
| Kennzahlen-Abweichungen zu Google Analytics | Definitionen §2.6 in der UI erklären („So zählen wir“) |
| KI-Halluzinationen | Werkzeugzwang, Zahlenprüfer, Protokoll, Opt-in |
