import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { coreSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { toPermissionSet, type ModuleKey, type Permission, type PermissionSet } from "../domain/permissions";
import { getTenant, type Tenant } from "./tenants";

/**
 * Rechte des angemeldeten Nutzers in einem Unternehmen – berechnet von core.can()
 * in der Datenbank (Basisrolle, eigene Rollen, Modulfreischaltung, Sperre).
 * Einmal pro Anfrage und Unternehmen abgefragt.
 */
export const getMyPermissions = cache(async (tenantId: string): Promise<PermissionSet> => {
  const db = coreSchema(await createSupabaseServerClient());
  const { data, error } = await db.rpc("my_permissions", { p_tenant: tenantId });
  if (error) throw error;
  return toPermissionSet(data ?? []);
});

export const can = async (tenantId: string, permission: Permission): Promise<boolean> =>
  (await getMyPermissions(tenantId)).has(permission);

/**
 * Für Seiten und Server Actions: Unternehmen nur liefern, wenn der Nutzer Mitglied ist
 * und das Recht hat. Die Datenbank prüft bei jedem Zugriff zusätzlich selbst (RLS).
 */
export const getTenantWithPermission = async (tenantId: string, permission: Permission): Promise<Tenant | null> => {
  const tenant = await getTenant(tenantId);
  if (!tenant) return null;
  return (await can(tenant.id, permission)) ? tenant : null;
};

/** Wie getTenantWithPermission, aber für Seiten: ohne Recht → 404 (keine Auskunft, ob es das Unternehmen gibt). */
export const requireTenantPermission = async (tenantId: string, permission: Permission): Promise<Tenant> => {
  const tenant = await getTenantWithPermission(tenantId, permission);
  if (!tenant) notFound();
  return tenant;
};

export type TenantModule = {
  key: ModuleKey | string;
  name: string;
  description: string;
  category: string;
  status: "available" | "beta" | "planned" | "retired";
  isCore: boolean;
  enabled: boolean;
};

const MODULE_STATUSES = new Set(["available", "beta", "planned", "retired"]);

/** Modulkatalog mit Freischaltung für ein Unternehmen (nur für Mitglieder lesbar). */
export const listTenantModules = cache(async (tenantId: string): Promise<TenantModule[]> => {
  const db = coreSchema(await createSupabaseServerClient());
  const [modules, enabled] = await Promise.all([
    db.from("modules").select("key, name, description, category, status, is_core, sort_order").order("sort_order"),
    db.from("tenant_modules").select("module_key, enabled, valid_until").eq("tenant_id", tenantId),
  ]);
  if (modules.error) throw modules.error;
  if (enabled.error) throw enabled.error;

  const now = Date.now();
  const active = new Set(
    enabled.data
      .filter((row) => row.enabled && (!row.valid_until || Date.parse(row.valid_until) > now))
      .map((row) => row.module_key),
  );
  return modules.data.map((row) => {
    const status = (MODULE_STATUSES.has(row.status) ? row.status : "planned") as TenantModule["status"];
    const usable = status === "available" || status === "beta";
    return {
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      status,
      isCore: row.is_core,
      enabled: usable && (row.is_core || active.has(row.key)),
    };
  });
});
