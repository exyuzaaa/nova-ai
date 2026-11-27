import "server-only";
import { cache } from "react";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { hasRole, isMemberRole, type MemberRole } from "../domain/roles";
import { isInvitationToken, uuidSchema } from "../domain/tenant-validation";

/** Ein Unternehmen (Mandant), in dem der angemeldete Nutzer Mitglied ist, samt seiner Rolle. */
export type Tenant = {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  /** Vom Betreiber gesperrte Unternehmen bleiben sichtbar, aber ohne Rechte (core.can). */
  suspended: boolean;
};

export type Member = {
  memberId: string;
  userId: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  isSelf: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
};

/**
 * Alle Unternehmen des angemeldeten Nutzers. Grundlage jeder Tenant-Auflösung:
 * Ein Unternehmen gilt nur dann als ausgewählt, wenn es in dieser Liste steht.
 */
export const listMyTenants = cache(async (): Promise<Tenant[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const db = coreSchema(await createSupabaseServerClient());
  const { data, error } = await db
    .from("tenant_members")
    .select("role, tenants(id, name, slug, status)")
    .eq("user_id", user.id);
  if (error) throw error;
  return data
    .flatMap((row) =>
      row.tenants && isMemberRole(row.role)
        ? [
            {
              id: row.tenants.id,
              name: row.tenants.name,
              slug: row.tenants.slug,
              role: row.role,
              suspended: row.tenants.status !== "active",
            },
          ]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
});

/** Unternehmen nur zurückgeben, wenn der Nutzer Mitglied ist (und optional mindestens `minimum` hat). */
export const getTenant = async (tenantId: string, minimum: MemberRole = "viewer"): Promise<Tenant | null> => {
  if (!uuidSchema.safeParse(tenantId).success) return null;
  const tenant = (await listMyTenants()).find((entry) => entry.id === tenantId);
  return tenant && hasRole(tenant.role, minimum) ? tenant : null;
};

export const listMembers = async (tenantId: string): Promise<Member[]> => {
  const db = coreSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("list_members", { p_tenant: tenantId });
  if (error) throw error;
  return (data ?? []).flatMap((row) =>
    isMemberRole(row.role)
      ? [
          {
            memberId: row.member_id,
            userId: row.user_id,
            email: row.email,
            role: row.role,
            joinedAt: row.created_at,
            isSelf: row.is_self,
          },
        ]
      : [],
  );
};

/** Offene Einladungen – nur für Admins sichtbar (RLS), sonst leer. */
export const listPendingInvitations = async (tenant: Tenant): Promise<PendingInvitation[]> => {
  if (!hasRole(tenant.role, "admin")) return [];
  const db = coreSchema(await createSupabaseServerClient());
  const { data, error } = await db
    .from("invitations")
    .select("id, email, role, expires_at")
    .eq("tenant_id", tenant.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.flatMap((row) =>
    isMemberRole(row.role) ? [{ id: row.id, email: row.email, role: row.role, expiresAt: row.expires_at }] : [],
  );
};

export type InvitationPreview = {
  tenantName: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  status: "pending" | "accepted" | "expired";
};

export const getInvitationPreview = async (token: string): Promise<InvitationPreview | null> => {
  if (!isInvitationToken(token)) return null;
  const db = coreSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("get_invitation", { p_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row || !isMemberRole(row.role)) return null;
  const status = row.status === "accepted" || row.status === "expired" ? row.status : "pending";
  return { tenantName: row.tenant_name, email: row.email, role: row.role, expiresAt: row.expires_at, status };
};
