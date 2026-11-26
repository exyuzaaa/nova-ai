# Tracking einbauen

## Einbau

In den `<head>` jeder Seite (die Zeile mit der eigenen Tracking-ID steht in NOVA unter Einstellungen → „Tracking einbauen“):

```html
<script defer src="https://nova-ai-1bjp.vercel.app/tracker.js" data-site-id="ns_…"></script>
```

Optionale Attribute:

| Attribut | Wirkung |
|---|---|
| `data-auto="forms,scroll"` | zusätzlich abgeschickte Formulare (nur Name, nie Inhalte) und Scrolltiefe – in den Tracking-Einstellungen der Website freischalten |
| `data-consent="wait"` | sendet erst nach `novaAnalytics.consent("granted")` (für den Modus „nur mit Einwilligung“) |
| `data-api="https://…"` | eigener Endpunkt, z. B. ein Proxy auf der eigenen Domain gegen Werbeblocker |

## Eigene Events

```js
window.novaAnalytics.track("contact_form_submitted", { form_name: "kontakt" });
```

Wird das Skript mit `defer` geladen, können Aufrufe vorher gepuffert werden:

```html
<script>window.novaAnalytics = window.novaAnalytics || { q: [] };
["track","consent","optOut","optIn"].forEach(function (m) { window.novaAnalytics[m] = window.novaAnalytics[m] || function () { window.novaAnalytics.q.push([m].concat([].slice.call(arguments))); }; });</script>
```

Eigenschaften: max. 30, nur Text/Zahl/Wahrheitswert, Texte ≤ 500 Zeichen. Werte, die wie E-Mail-Adresse,
Telefonnummer oder IBAN aussehen, werden serverseitig verworfen.

## Was automatisch erfasst wird

Seitenaufrufe (auch Seitenwechsel in Single-Page-Apps), externe Herkunft und UTM-Parameter, aktive Verweildauer,
Klicks auf externe Links, Downloads, Telefon- und E-Mail-Links (ohne Nummer/Adresse).

## Datenschutz

- Keine Cookies, kein Speicher im Browser (außer einem freiwilligen Opt-out über `novaAnalytics.optOut()`).
- Die IP-Adresse wird nur im Arbeitsspeicher zu einem täglich wechselnden Hash verarbeitet; der Tages-Salt wird nach
  zwei Tagen gelöscht. Besucher sind dadurch nicht über Tage wiedererkennbar.
- Gespeichert werden nur Host, Pfad und UTM-Parameter – keine sonstigen URL-Parameter, keine Click-ID-Werte.
  E-Mail-Adressen und lange Tokens in Pfaden werden ersetzt.
- „Global Privacy Control“ und „Do Not Track“ werden respektiert; Bots werden verworfen.
- Events werden nur angenommen, wenn die Domain zur Website passt (inkl. Subdomains und Zusatzdomains).

## Technik

`tracker.js` (Quelle `tracker/src/index.ts`, < 2 KB gzip) → `POST /api/e` (Validierung, Bot-Filter, Kategorien,
Rate-Limit je Server-Instanz) → `public.nova_ingest_event()` in Supabase (Domainprüfung, Einstellungen, Session,
Speicherung). Wartung per `pg_cron`: Salts täglich löschen, Partitionen anlegen, Aufbewahrungsfristen.

Bekannte Grenzen: Das Rate-Limit gilt pro Server-Instanz. Für sehr viel Traffic ist ein globaler Puffer
(Upstash Redis, Architektur §2.4) vorgesehen. Die Auswertung im Dashboard folgt mit Phase 5.
