import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ensureSessionAccepted, requireUser, type CurrentUser } from "@/modules/auth/server/session";
import type { Permission, PermissionSet } from "../domain/permissions";
import { getMyPermissions, listTenantModules, type TenantModule } from "./permissions";
import { listMyTenants, type Tenant } from "./tenants";

export type TenantContext = {
  user: CurrentUser;
  tenant: Tenant;
  tenants: Tenant[];
  permissions: PermissionSet;
  modules: TenantModule[];
};

/**
 * Unternehmenskontext für /app/[unternehmen]. Das Kürzel aus der Adresse ist nur eine
 * Auswahl: Es wird ausschließlich unter den Unternehmen gesucht, in denen der
 * angemeldete Nutzer Mitglied ist. Fremde oder unbekannte Kürzel → 404.
 */
export const loadTenantContext = cache(async (slug: string): Promise<TenantContext> => {
  const user = await requireUser(`/app/${encodeURIComponent(slug)}`);
  const tenants = await listMyTenants();
  const tenant = tenants.find((entry) => entry.slug === slug);
  if (!tenant) {
    await ensureSessionAccepted();
    notFound();
  }
  const [permissions, modules] = await Promise.all([getMyPermissions(tenant.id), listTenantModules(tenant.id)]);
  return { user, tenant, tenants, permissions, modules };
});

/** Wie loadTenantContext, verlangt aber ein Recht (sonst 404 – keine Auskunft über Bereiche). */
export const requireTenantContext = async (slug: string, permission: Permission): Promise<TenantContext> => {
  const context = await loadTenantContext(slug);
  if (!context.permissions.has(permission)) notFound();
  return context;
};
