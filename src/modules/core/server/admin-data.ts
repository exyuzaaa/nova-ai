import "server-only";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { isPermission, type Permission } from "../domain/permissions";
import { isMemberRole, type MemberRole } from "../domain/roles";

const db = async () => coreSchema(await createSupabaseServerClient());

export type TenantProfile = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  vatId: string | null;
  industry: string | null;
  companySize: string | null;
  locale: string;
  timezone: string;
  currency: string;
  status: string;
  createdAt: string;
};

export const getTenantProfile = async (tenantId: string): Promise<TenantProfile | null> => {
  const { data, error } = await (await db())
    .from("tenants")
    .select(
      "id, name, slug, legal_name, street, postal_code, city, country_code, phone, email, website, vat_id, industry, company_size, locale, timezone, currency, status, created_at",
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    legalName: data.legal_name,
    street: data.street,
    postalCode: data.postal_code,
    city: data.city,
    countryCode: data.country_code,
    phone: data.phone,
    email: data.email,
    website: data.website,
    vatId: data.vat_id,
    industry: data.industry,
    companySize: data.company_size,
    locale: data.locale,
    timezone: data.timezone,
    currency: data.currency,
    status: data.status,
    createdAt: data.created_at,
  };
};

export type PermissionInfo = {
  key: Permission;
  module: string;
  name: string;
  description: string | null;
  defaultRole: MemberRole;
  grantable: boolean;
  sensitive: boolean;
};

export const listPermissionCatalog = async (): Promise<PermissionInfo[]> => {
  const { data, error } = await (await db())
    .from("permissions")
    .select("key, module_key, name, description, default_role, grantable, is_sensitive, sort_order")
    .order("module_key")
    .order("sort_order");
  if (error) throw error;
  return data.flatMap((row) =>
    isPermission(row.key) && isMemberRole(row.default_role)
      ? [
          {
            key: row.key,
            module: row.module_key,
            name: row.name,
            description: row.description,
            defaultRole: row.default_role,
            grantable: row.grantable,
            sensitive: row.is_sensitive,
          },
        ]
      : [],
  );
};

export type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  memberIds: string[];
};

export const listCustomRoles = async (tenantId: string): Promise<CustomRole[]> => {
  const client = await db();
  const [roles, grants, assignments] = await Promise.all([
    client.from("roles").select("id, name, description").eq("tenant_id", tenantId).order("name"),
    client.from("role_permissions").select("role_id, permission_key").eq("tenant_id", tenantId),
    client.from("member_roles").select("role_id, member_id").eq("tenant_id", tenantId),
  ]);
  if (roles.error) throw roles.error;
  if (grants.error) throw grants.error;
  if (assignments.error) throw assignments.error;
  return roles.data.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: grants.data
      .filter((grant) => grant.role_id === role.id)
      .map((grant) => grant.permission_key)
      .filter(isPermission),
    memberIds: assignments.data.filter((row) => row.role_id === role.id).map((row) => row.member_id),
  }));
};

export type Department = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  leadMemberId: string | null;
};

export type Team = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  leadMemberId: string | null;
  memberIds: string[];
};

export const listOrganization = async (tenantId: string): Promise<{ departments: Department[]; teams: Team[] }> => {
  const client = await db();
  const [departments, teams, teamMembers] = await Promise.all([
    client.from("departments").select("id, name, description, parent_id, lead_member_id").eq("tenant_id", tenantId).order("name"),
    client.from("teams").select("id, name, description, department_id, lead_member_id").eq("tenant_id", tenantId).order("name"),
    client.from("team_members").select("team_id, member_id").eq("tenant_id", tenantId),
  ]);
  if (departments.error) throw departments.error;
  if (teams.error) throw teams.error;
  if (teamMembers.error) throw teamMembers.error;
  return {
    departments: departments.data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      parentId: row.parent_id,
      leadMemberId: row.lead_member_id,
    })),
    teams: teams.data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      departmentId: row.department_id,
      leadMemberId: row.lead_member_id,
      memberIds: teamMembers.data.filter((entry) => entry.team_id === row.id).map((entry) => entry.member_id),
    })),
  };
};

export type AuditEntry = {
  id: number;
  action: string;
  actorType: string;
  actorId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const AUDIT_PAGE_SIZE = 50;

/** Protokoll seitenweise (neueste zuerst); `hasMore` zeigt, ob eine weitere Seite existiert. */
export const listAuditLog = async (tenantId: string, page: number): Promise<{ entries: AuditEntry[]; hasMore: boolean }> => {
  const from = Math.max(0, page - 1) * AUDIT_PAGE_SIZE;
  const { data, error } = await (await db())
    .from("audit_logs")
    .select("id, action, actor_type, actor_id, target_type, metadata, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE);
  if (error) throw error;
  const rows = data.slice(0, AUDIT_PAGE_SIZE).map((row) => ({
    id: row.id,
    action: row.action,
    actorType: row.actor_type,
    actorId: row.actor_id,
    targetType: row.target_type,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {},
    createdAt: row.created_at,
  }));
  return { entries: rows, hasMore: data.length > AUDIT_PAGE_SIZE };
};
