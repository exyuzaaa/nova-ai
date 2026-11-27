import type { ModuleKey, Permission } from "../domain/permissions";

/**
 * Navigation der NOVA-Plattform unter /app/[unternehmen].
 * Module erscheinen nur, wenn sie für das Unternehmen freigeschaltet sind UND eine
 * Oberfläche haben (`segment`). Verwaltungsbereiche erscheinen nur mit dem nötigen Recht.
 * Es gibt keine Einträge ohne Funktion.
 */
export type PlatformIcon =
  | "overview"
  | "analytics"
  | "crm"
  | "projects"
  | "calendar"
  | "hr"
  | "finance"
  | "documents"
  | "messaging"
  | "support"
  | "inventory"
  | "marketing"
  | "automation"
  | "company"
  | "members"
  | "roles"
  | "departments"
  | "modules"
  | "audit";

export type PlatformNavItem = { id: string; label: string; href: string; icon: PlatformIcon; exact?: boolean };
export type PlatformNavGroup = { label: string; items: PlatformNavItem[] };

type ModuleNav = { label: string; icon: PlatformIcon; segment: string | null; permission: Permission | null };

/** segment = null: Modul hat noch keine Oberfläche und wird nicht verlinkt. */
export const MODULE_NAVIGATION: Record<Exclude<ModuleKey, "core">, ModuleNav> = {
  crm: { label: "CRM", icon: "crm", segment: null, permission: null },
  projects: { label: "Projekte", icon: "projects", segment: null, permission: null },
  calendar: { label: "Kalender", icon: "calendar", segment: null, permission: null },
  hr: { label: "Personal", icon: "hr", segment: null, permission: null },
  finance: { label: "Finanzen", icon: "finance", segment: null, permission: null },
  documents: { label: "Dokumente", icon: "documents", segment: null, permission: null },
  messaging: { label: "Kommunikation", icon: "messaging", segment: null, permission: null },
  support: { label: "Support", icon: "support", segment: null, permission: null },
  inventory: { label: "Lager", icon: "inventory", segment: null, permission: null },
  marketing: { label: "Marketing", icon: "marketing", segment: null, permission: null },
  automation: { label: "Automatisierungen", icon: "automation", segment: null, permission: null },
  analytics: { label: "Analytics", icon: "analytics", segment: "analytics", permission: "analytics.view" },
};

const ADMIN_NAVIGATION: { id: string; label: string; segment: string; icon: PlatformIcon; permission: Permission }[] = [
  { id: "company", label: "Unternehmen", segment: "verwaltung", icon: "company", permission: "core.members.read" },
  { id: "members", label: "Mitglieder", segment: "verwaltung/mitglieder", icon: "members", permission: "core.members.read" },
  { id: "roles", label: "Rollen und Rechte", segment: "verwaltung/rollen", icon: "roles", permission: "core.members.read" },
  { id: "departments", label: "Abteilungen und Teams", segment: "verwaltung/abteilungen", icon: "departments", permission: "core.departments.read" },
  { id: "modules", label: "Module", segment: "verwaltung/module", icon: "modules", permission: "core.members.read" },
  { id: "audit", label: "Protokoll", segment: "verwaltung/protokoll", icon: "audit", permission: "core.audit.read" },
];

export const tenantBasePath = (slug: string) => `/app/${encodeURIComponent(slug)}`;

export const buildPlatformNavigation = (
  slug: string,
  permissions: ReadonlySet<string>,
  enabledModules: ReadonlySet<string>,
): PlatformNavGroup[] => {
  const base = tenantBasePath(slug);
  const modules = (Object.entries(MODULE_NAVIGATION) as [ModuleKey, ModuleNav][])
    .filter(([key, nav]) => nav.segment && enabledModules.has(key) && (!nav.permission || permissions.has(nav.permission)))
    .map(([key, nav]) => ({ id: key, label: nav.label, href: `${base}/${nav.segment}`, icon: nav.icon }));
  const admin = ADMIN_NAVIGATION.filter((item) => permissions.has(item.permission)).map((item) => ({
    id: item.id,
    label: item.label,
    href: `${base}/${item.segment}`,
    icon: item.icon,
    exact: item.segment === "verwaltung",
  }));

  return [
    { label: "Start", items: [{ id: "overview", label: "Übersicht", href: base, icon: "overview" as const, exact: true }] },
    ...(modules.length > 0 ? [{ label: "Module", items: modules }] : []),
    ...(admin.length > 0 ? [{ label: "Verwaltung", items: admin }] : []),
  ];
};

/** Aktiver Eintrag: exakter Treffer oder Unterseite (nicht für exakte Einträge). */
export const isNavItemActive = (item: PlatformNavItem, pathname: string): boolean =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
