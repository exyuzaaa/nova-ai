import "server-only";
import { cache } from "react";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/modules/auth/server/session";
import { hasRole, isMemberRole, type MemberRole } from "../domain/roles";

export type Organization = { id: string; name: string; slug: string; role: MemberRole };

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

export const listMyOrganizations = cache(async (): Promise<Organization[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id);
  if (error) throw error;
  return data
    .flatMap((row) =>
      row.organizations && isMemberRole(row.role)
        ? [{ id: row.organizations.id, name: row.organizations.name, slug: row.organizations.slug, role: row.role }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
});

export const getOrganization = async (organizationId: string): Promise<Organization | null> =>
  (await listMyOrganizations()).find((org) => org.id === organizationId) ?? null;

export const listMembers = async (organizationId: string): Promise<Member[]> => {
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("list_members", { p_org: organizationId });
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
export const listPendingInvitations = async (organization: Organization): Promise<PendingInvitation[]> => {
  if (!hasRole(organization.role, "admin")) return [];
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db
    .from("organization_invitations")
    .select("id, email, role, expires_at")
    .eq("organization_id", organization.id)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.flatMap((row) =>
    isMemberRole(row.role) ? [{ id: row.id, email: row.email, role: row.role, expiresAt: row.expires_at }] : [],
  );
};

export type InvitationPreview = {
  organizationName: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  status: "pending" | "accepted" | "expired";
};

export const getInvitationPreview = async (token: string): Promise<InvitationPreview | null> => {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const db = analyticsSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("get_invitation", { p_token: token });
  if (error) throw error;
  const row = data?.[0];
  if (!row || !isMemberRole(row.role)) return null;
  const status = row.status === "accepted" || row.status === "expired" ? row.status : "pending";
  return { organizationName: row.organization_name, email: row.email, role: row.role, expiresAt: row.expires_at, status };
};
