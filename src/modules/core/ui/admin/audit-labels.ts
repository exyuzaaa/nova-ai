import { ROLE_LABELS, isMemberRole } from "../../domain/roles";

/** Lesbare Beschreibung eines Protokolleintrags (ohne personenbezogene Details über das Nötige hinaus). */
type AuditLike = { action: string; metadata: Record<string, unknown> };

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const role = (value: unknown): string => (isMemberRole(value) ? ROLE_LABELS[value] : text(value));

const LABELS: Record<string, (meta: Record<string, unknown>) => string> = {
  "tenants.insert": (m) => `Unternehmen „${text(m.name)}“ angelegt`,
  "tenants.update": (m) => `Unternehmensprofil geändert${m.status === "suspended" ? " (gesperrt)" : ""}`,
  "tenant_members.insert": (m) => `Mitglied hinzugefügt (${role(m.role)})`,
  "tenant_members.update": (m) =>
    m.previous_role && m.previous_role !== m.role ? `Rolle geändert: ${role(m.previous_role)} → ${role(m.role)}` : "Mitglied geändert",
  "tenant_members.delete": () => "Mitglied entfernt",
  "invitations.insert": (m) => `Einladung an ${text(m.email)} erstellt (${role(m.role)})`,
  "invitations.update": (m) => (m.accepted ? `Einladung von ${text(m.email)} angenommen` : "Einladung geändert"),
  "invitations.delete": (m) => `Einladung an ${text(m.email)} entfernt`,
  "tenant_modules.insert": (m) => `Modul ${text(m.module)} ${m.enabled ? "freigeschaltet" : "angelegt"}`,
  "tenant_modules.update": (m) => `Modul ${text(m.module)} ${m.enabled ? "eingeschaltet" : "ausgeschaltet"}`,
  "roles.insert": (m) => `Rolle „${text(m.name)}“ angelegt`,
  "roles.update": (m) => `Rolle „${text(m.name)}“ geändert`,
  "roles.delete": (m) => `Rolle „${text(m.name)}“ gelöscht`,
  "role_permissions.insert": (m) => `Recht ${text(m.permission)} einer Rolle hinzugefügt`,
  "role_permissions.delete": (m) => `Recht ${text(m.permission)} aus einer Rolle entfernt`,
  "member_roles.insert": () => "Rolle an ein Mitglied vergeben",
  "member_roles.delete": () => "Rolle eines Mitglieds entzogen",
  "departments.insert": (m) => `Abteilung „${text(m.name)}“ angelegt`,
  "departments.update": (m) => `Abteilung „${text(m.name)}“ geändert`,
  "departments.delete": (m) => `Abteilung „${text(m.name)}“ gelöscht`,
  "teams.insert": (m) => `Team „${text(m.name)}“ angelegt`,
  "teams.update": (m) => `Team „${text(m.name)}“ geändert`,
  "teams.delete": (m) => `Team „${text(m.name)}“ gelöscht`,
  "websites.insert": (m) => `Website ${text(m.domain)} angelegt`,
  "websites.update": (m) => (m.deleted ? `Website ${text(m.domain)} gelöscht` : `Website ${text(m.domain)} geändert`),
  "tracking_settings.update": () => "Tracking-Einstellungen geändert",
  // Einträge aus der Zeit vor dem gemeinsamen Kern
  "organizations.insert": (m) => `Unternehmen „${text(m.name)}“ angelegt`,
  "organization_members.insert": (m) => `Mitglied hinzugefügt (${role(m.role)})`,
};

export const describeAuditEntry = (entry: AuditLike): string => LABELS[entry.action]?.(entry.metadata) ?? entry.action;
