# Belegversand per Gmail – Einrichtung

NOVA versendet Angebote, Rechnungen und Gutschriften über das **eigene Gmail- bzw. Google-Workspace-Postfach
des jeweiligen Unternehmens**. Jedes Unternehmen verbindet sein Postfach selbst unter
**Finanzen → Einstellungen → Mit Gmail verbinden**. NOVA erhält dabei nur das Recht „E-Mails senden“
(`gmail.send`), keinen Lesezugriff, und speichert kein Passwort.

Damit der Knopf funktioniert, braucht die NOVA-Installation **einmalig** einen Google-Zugang (OAuth-Client).

## 1. Google Cloud: Projekt und Gmail-API

1. https://console.cloud.google.com/projectcreate → Projektname z. B. „NOVA“ → **Erstellen**.
2. https://console.cloud.google.com/apis/library/gmail.googleapis.com → **Aktivieren**.

## 2. Zustimmungsbildschirm (OAuth consent screen)

1. https://console.cloud.google.com/auth/branding → App-Name „NOVA“, Support-E-Mail, Kontakt-E-Mail → speichern.
2. https://console.cloud.google.com/auth/audience → Nutzertyp **Extern**.
   Solange die App im Status **Testen** ist, unter „Testnutzer“ jede Google-Adresse eintragen, die verbunden werden soll
   (max. 100). Google zeigt Testnutzern einen Warnhinweis „nicht überprüft“ – das ist in dieser Phase normal.
3. https://console.cloud.google.com/auth/scopes → **Bereiche hinzufügen** → `.../auth/gmail.send` auswählen → speichern.

## 3. OAuth-Client anlegen

1. https://console.cloud.google.com/auth/clients/create → Anwendungstyp **Webanwendung**, Name „NOVA“.
2. **Autorisierte Weiterleitungs-URIs**: `https://nova-ai-1bjp.vercel.app/api/google/callback`
   (bei eigener Domain zusätzlich `https://<domain>/api/google/callback`).
3. **Erstellen** → Client-ID und Clientschlüssel (Secret) werden angezeigt.

## 4. In Vercel hinterlegen

1. Vercel → Projekt → **Settings → Environment Variables**.
2. `GOOGLE_CLIENT_ID` = Client-ID, `GOOGLE_CLIENT_SECRET` = Clientschlüssel (Umgebung: Production).
3. **Deployments → letztes Deployment → Redeploy**, damit die Werte gelten.

Hinweis: Das Client-Secret verschlüsselt auch die gespeicherten Google-Freigaben. Wird es später geändert,
müssen alle Unternehmen Gmail einmal neu verbinden.

## 5. Vor dem Verkauf

Für Kunden außerhalb der Testnutzer-Liste muss die App bei Google **verifiziert** werden (`gmail.send` ist ein
„sensibler“ Bereich). Voraussetzungen: eigene Domain, Startseite und Datenschutzerklärung auf dieser Domain,
Begründung und ggf. Demo-Video. Ohne Verifizierung können nur die eingetragenen Testnutzer verbinden.

## Grenzen

- Gmail-Versandlimits gelten pro Postfach (privates Gmail ca. 500 Empfänger/Tag, Workspace höher).
- Google-Workspace-Administratoren können Drittanbieter-Apps sperren; dann muss NOVA dort freigegeben werden.
