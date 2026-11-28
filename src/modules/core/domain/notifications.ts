/**
 * Arten von Benachrichtigungen (Spiegel der Trigger in der Datenbank). Jede Art kann
 * einzeln abbestellt werden. Neue Arten entstehen mit den Modulen.
 */
export const NOTIFICATION_KINDS = [
  { kind: "core.member.joined", label: "Neue Mitglieder", description: "Jemand tritt deinem Unternehmen bei (für Administratoren)." },
  { kind: "core.member.role_changed", label: "Rollenänderungen", description: "Deine Basisrolle wurde geändert." },
  { kind: "core.role.assigned", label: "Zusätzliche Rollen", description: "Dir wurde eine eigene Rolle zugewiesen." },
  { kind: "core.team.joined", label: "Teams", description: "Du wurdest einem Team hinzugefügt." },
  { kind: "core.module.changed", label: "Module", description: "Ein Modul wurde ein- oder ausgeschaltet (für Administratoren)." },
  { kind: "crm.assigned", label: "CRM: Zuständigkeit", description: "Dir wurde ein Kunde, Lead oder eine Verkaufschance zugewiesen." },
  { kind: "crm.task.assigned", label: "CRM: Aufgaben", description: "Dir wurde eine Aufgabe zugewiesen." },
  { kind: "crm.task.due", label: "CRM: Fällige Aufgaben", description: "Eine deiner Aufgaben ist fällig." },
  { kind: "crm.follow_up.due", label: "CRM: Wiedervorlagen", description: "Ein Lead steht zur Wiedervorlage an." },
  { kind: "projects.task.assigned", label: "Projekte: Aufgaben", description: "Dir wurde eine Projektaufgabe zugewiesen." },
  { kind: "projects.task.due", label: "Projekte: Fällige Aufgaben", description: "Eine deiner Projektaufgaben ist fällig." },
  { kind: "projects.task.commented", label: "Projekte: Kommentare", description: "Neuer Kommentar zu einer deiner Aufgaben." },
  { kind: "calendar.invited", label: "Kalender: Einladungen", description: "Du wurdest zu einem Termin eingeladen." },
  { kind: "calendar.updated", label: "Kalender: Änderungen", description: "Ein Termin, zu dem du eingeladen bist, wurde verschoben." },
  { kind: "calendar.response", label: "Kalender: Antworten", description: "Jemand hat auf deine Einladung geantwortet." },
  { kind: "calendar.reminder", label: "Kalender: Erinnerungen", description: "Erinnerung vor einem Termin." },
  { kind: "projects.member.added", label: "Projekte: Mitgliedschaft", description: "Du wurdest einem Projekt hinzugefügt." },
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["kind"];

export const isNotificationKind = (value: unknown): value is NotificationKind =>
  typeof value === "string" && NOTIFICATION_KINDS.some((entry) => entry.kind === value);

/**
 * Ziel eines Eintrags (Benachrichtigung, Suchtreffer) in eine Adresse umwandeln:
 * relative Ziele liegen unterhalb des Unternehmens, absolute bleiben, alles andere
 * (fremde Domains, Protokolle) wird verworfen.
 */
export const resolveTenantHref = (base: string, href: string | null | undefined): string | null => {
  if (!href) return null;
  if (href.startsWith("//") || href.includes(":") || href.includes("\\")) return null;
  if (href.startsWith("/")) return href;
  return `${base}/${href}`;
};
