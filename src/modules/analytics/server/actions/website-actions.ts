"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors } from "@/modules/auth/domain/validation";
import { databaseMessage, failure, FORBIDDEN, formValue, type ActionState } from "@/modules/core/server/action-state";
import { getTenant } from "@/modules/core/server/tenants";
import { websiteSchema } from "../../domain/tenancy-validation";
import { getSiteWithRole } from "../sites";

const db = async () => analyticsSchema(await createSupabaseServerClient());

const parseWebsite = (formData: FormData) =>
  websiteSchema.safeParse({
    name: formValue(formData, "name"),
    domain: formValue(formData, "domain"),
    timezone: formValue(formData, "timezone"),
  });

export async function createWebsiteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/onboarding");
  const tenant = await getTenant(formValue(formData, "tenantId"), "admin");
  if (!tenant) return failure("Nur Administratoren können Websites hinzufügen.");
  const parsed = parseWebsite(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  // ID serverseitig erzeugen statt INSERT … RETURNING: Die Lese-Policy sieht die neue
  // Zeile im selben Statement noch nicht und würde die Rückgabe verweigern.
  const id = crypto.randomUUID();
  const { error } = await (await db()).from("websites").insert({ id, organization_id: tenant.id, ...parsed.data });
  if (error) return failure(databaseMessage(error));
  redirect(`/analytics/${id}`);
}

export async function updateWebsiteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const site = await getSiteWithRole(formValue(formData, "siteId"), "admin");
  if (!site) return failure(FORBIDDEN);
  const parsed = parseWebsite(formData);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await (await db()).from("websites").update(parsed.data).eq("id", site.id);
  if (error) return failure(databaseMessage(error));
  refresh();
  return { status: "success", message: "Website gespeichert." };
}
