/** Rollen in aufsteigender Berechtigung – identisch mit dem DB-Enum analytics.member_role. */
export const MEMBER_ROLES = ["viewer", "analyst", "admin", "owner"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  viewer: "Viewer",
  analyst: "Analyst",
  admin: "Administrator",
  owner: "Owner",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  viewer: "Sieht Dashboards und Berichte.",
  analyst: "Pflegt zusätzlich Ziele, Funnels, Kampagnen und Berichte.",
  admin: "Verwaltet zusätzlich Websites, Tracking und Mitglieder.",
  owner: "Volle Kontrolle inklusive Owner-Rechten und Löschung.",
};

export const isMemberRole = (value: unknown): value is MemberRole =>
  typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);

export const hasRole = (role: MemberRole, minimum: MemberRole): boolean =>
  MEMBER_ROLES.indexOf(role) >= MEMBER_ROLES.indexOf(minimum);

/** Rollen, die eine Person mit `actor`-Rolle vergeben darf (Owner nur durch Owner). */
export const assignableRoles = (actor: MemberRole): MemberRole[] => {
  if (actor === "owner") return [...MEMBER_ROLES];
  if (actor === "admin") return ["viewer", "analyst", "admin"];
  return [];
};

/** Rollen, die per Einladung vergeben werden können (nie Owner). */
export const invitableRoles = (actor: MemberRole): MemberRole[] =>
  assignableRoles(actor).filter((role) => role !== "owner");
