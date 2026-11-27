/**
 * Rechtekatalog (Spiegel von core.permissions) und Modulschlüssel (core.modules).
 * Die Datenbank ist maßgeblich; diese Konstanten sorgen nur für Tippsicherheit im Code.
 * Neue Rechte entstehen immer per Migration UND hier.
 */
export const MODULE_KEYS = [
  "core",
  "crm",
  "projects",
  "calendar",
  "hr",
  "finance",
  "documents",
  "messaging",
  "support",
  "inventory",
  "marketing",
  "automation",
  "analytics",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const PERMISSIONS = [
  "core.members.read",
  "core.members.manage",
  "core.roles.manage",
  "core.departments.read",
  "core.departments.manage",
  "core.modules.manage",
  "core.settings.manage",
  "core.audit.read",
  "core.billing.manage",
  "analytics.view",
  "analytics.edit",
  "analytics.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const isModuleKey = (value: unknown): value is ModuleKey =>
  typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);

/** Modul, zu dem ein Recht gehört ("crm.customers.read" → "crm"). */
export const permissionModule = (permission: string): string => permission.split(".", 1)[0];

/** Menge der Rechte eines Nutzers in einem Unternehmen. */
export type PermissionSet = ReadonlySet<Permission>;

export const toPermissionSet = (keys: readonly unknown[]): PermissionSet =>
  new Set(keys.filter(isPermission));

export const hasPermission = (set: PermissionSet, permission: Permission): boolean => set.has(permission);
