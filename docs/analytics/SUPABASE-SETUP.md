# Supabase-Projekt und Deployment einrichten

Diese Schritte verbinden NOVA mit dem **bestehenden** Supabase-Projekt. Es wird kein neues Projekt angelegt;
alle Tabellen liegen im eigenen Schema `analytics` und berühren vorhandene Tabellen nicht.

## 1. Migrationen einspielen

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <projekt-ref>
```

```bash
npx supabase db push
```

`db push` spielt `supabase/migrations/*.sql` ein. Vorher in einer Staging-Umgebung oder einem Supabase-Branch testen.

Danach die Datenbanktests gegen die lokale Umgebung laufen lassen (`npm run db:test`) – die Tests legen Testdaten an
und rollen sie zurück, sie sollten nicht gegen Produktion laufen.

## 2. Einstellungen im Supabase-Dashboard

| Bereich | Einstellung |
|---|---|
| Project Settings → Data API → Exposed schemas | `analytics` ergänzen |
| Authentication → Sign In / Providers → Email | „Confirm email“ aktivieren |
| Authentication → Sign In / Providers → Email | Minimum password length **10**, Password requirements **Letters and digits** |
| Authentication → URL Configuration → Site URL | Produktions-URL, z. B. `https://nova.example.de` |
| Authentication → URL Configuration → Redirect URLs | `https://nova.example.de/**` (und Preview-URLs, falls genutzt) |
| Authentication → Emails → Templates | Inhalte aus `supabase/templates/confirmation.html` (Confirm signup) und `supabase/templates/recovery.html` (Reset password) übernehmen |
| Authentication → Emails → SMTP Settings | Eigenen SMTP-Anbieter eintragen – der eingebaute Versand ist stark limitiert und nicht für Produktion gedacht |

Die E-Mail-Vorlagen verlinken auf `/auth/confirm?token_hash=…`. Dadurch funktionieren Bestätigungs- und
Passwort-Links auch, wenn sie auf einem anderen Gerät geöffnet werden.

## 3. Umgebungsvariablen (Vercel)

| Variable | Wert | Sichtbarkeit |
|---|---|---|
| `SUPABASE_URL` | `https://<projekt-ref>.supabase.co` | nur Server |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable Key (oder Legacy Anon Key) | nur Server |
| `APP_URL` | öffentliche URL der App (für Einladungslinks) | nur Server |
| `ANALYTICS_DEMO_ENABLED` | `false` (Standard in Produktion) | nur Server |

Kein `NEXT_PUBLIC_`-Präfix: Die App spricht Supabase ausschließlich serverseitig an. Ein Service-Role-Key wird in
Phase 3 nicht benötigt und darf nicht gesetzt werden, solange kein Hintergrundjob ihn braucht (ab Phase 4/5 für die
Event-Ingestion, dann nur serverseitig).

## 4. Prüfen nach dem Deployment

1. `/analytics` ohne Anmeldung aufrufen → Weiterleitung auf `/login`.
2. Konto registrieren → Bestätigungs-E-Mail → Link öffnen → Einrichtung.
3. Organisation und Website anlegen → Einstellungen zeigen eine Tracking-ID `ns_…`.
4. „Passwort vergessen“ durchspielen.
5. Zweites Konto einladen, Einladung annehmen, Rollen prüfen.
6. Supabase-Dashboard → Advisors (Security/Performance) ohne Befund für das Schema `analytics`.

## Hinweise

- **Einladungen** werden derzeit als Link angezeigt, den Administratoren selbst weitergeben. Automatischer
  E-Mail-Versand folgt mit dem Berichtsversand (Phase 10).
- **Website-Beschränkung je Mitglied** (Tabelle `organization_member_websites`) ist in Datenbank und RLS umgesetzt
  und getestet; die Oberfläche dafür folgt mit den Agentur-Funktionen.
- **Organisation löschen** ist bewusst nur serverseitig möglich und bekommt mit dem Lösch- und
  Aufbewahrungskonzept (Phase 12) einen eigenen, abgesicherten Ablauf.
