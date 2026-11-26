"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { analyticsSchema, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/server/session";
import { fieldErrors, type FieldErrors } from "@/modules/auth/domain/validation";
import { assignableRoles, hasRole, isMemberRole } from "../../domain/roles";
import {
  invitationSchema,
  organizationSchema,
  slugify,
  uuidSchema,
  websiteSchema,
} from "../../domain/tenancy-validation";
import { getOrganization } from "../organizations";
import { getSiteWithRole } from "../sites";

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Einmalig angezeigter Einladungslink. */
  invitationLink?: string;
};

const value = (formData: FormData, key: string): string => {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
};

const failure = (message: string): ActionState => ({ status: "error", message });

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte versuche es erneut.";

/** Datenbankfehler in Meldungen übersetzen, ohne interne Details preiszugeben. */
const databaseMessage = (error: { code?: string; message?: string } | null): string => {
  switch (error?.code) {
    case "42501":
      return "Dafür fehlt dir die Berechtigung.";
    case "23505":
      return error.message?.includes("Mitglied") ? "Diese Person ist bereits Mitglied." : "Dieser Eintrag existiert bereits.";
    case "P0001":
      return error.message ?? GENERIC_ERROR;
    case "P0002":
      return "Die Einladung ist ungültig oder abgelaufen.";
    default:
      return GENERIC_ERROR;
  }
};

const db = async () => analyticsSchema(await createSupabaseServerClient());

// -----------------------------------------------------------------------------
// Organisation & erste Website (Onboarding)
// -----------------------------------------------------------------------------
export async function createOrganizationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/onboarding");
  const parsed = organizationSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = await db();
  const base = slugify(parsed.data.name);
  // Bei Namensgleichheit ein zufälliges Suffix anhängen (max. 3 Versuche).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`;
    const { error } = await client.rpc("create_organization", { p_name: parsed.data.name, p_slug: slug });
    if (!error) redirect("/onboarding");
    if (error.code !== "23505") return failure(databaseMessage(error));
  }
  return failure(GENERIC_ERROR);
}

export async function createWebsiteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/onboarding");
  const organizationId = value(formData, "organizationId");
  const organization = uuidSchema.safeParse(organizationId).success ? await getOrganization(organizationId) : null;
  if (!organization || !hasRole(organization.role, "admin")) {
    return failure("Nur Administratoren können Websites hinzufügen.");
  }
  const parsed = websiteSchema.safeParse({
    name: value(formData, "name"),
    domain: value(formData, "domain"),
    timezone: value(formData, "timezone"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  // ID serverseitig erzeugen statt INSERT … RETURNING: Die Lese-Policy sieht die neue
  // Zeile im selben Statement noch nicht und würde die Rückgabe verweigern.
  const id = crypto.randomUUID();
  const { error } = await (await db())
    .from("websites")
    .insert({ id, organization_id: organization.id, ...parsed.data });
  if (error) return failure(databaseMessage(error));
  redirect(`/analytics/${id}`);
}

// -----------------------------------------------------------------------------
// Website- und Organisationseinstellungen
// -----------------------------------------------------------------------------
export async function updateWebsiteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const site = await getSiteWithRole(value(formData, "siteId"), "admin");
  if (!site) return failure("Dafür fehlt dir die Berechtigung.");
  const parsed = websiteSchema.safeParse({
    name: value(formData, "name"),
    domain: value(formData, "domain"),
    timezone: value(formData, "timezone"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await (await db()).from("websites").update(parsed.data).eq("id", site.id);
  if (error) return failure(databaseMessage(error));
  refresh();
  return { status: "success", message: "Website gespeichert." };
}

export async function updateOrganizationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const organization = await getOrganization(value(formData, "organizationId"));
  if (!organization || !hasRole(organization.role, "admin")) return failure("Dafür fehlt dir die Berechtigung.");
  const parsed = organizationSchema.safeParse({ name: value(formData, "name") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { error } = await (await db()).from("organizations").update({ name: parsed.data.name }).eq("id", organization.id);
  if (error) return failure(databaseMessage(error));
  refresh();
  return { status: "success", message: "Organisation gespeichert." };
}

// -----------------------------------------------------------------------------
// Mitglieder & Einladungen
// -----------------------------------------------------------------------------
const appOrigin = async (): Promise<string> => {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
};

export async function inviteMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const organization = await getOrganization(value(formData, "organizationId"));
  if (!organization || !hasRole(organization.role, "admin")) return failure("Nur Administratoren können einladen.");
  const parsed = invitationSchema.safeParse({ email: value(formData, "email"), role: value(formData, "role") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { data: token, error } = await (await db()).rpc("create_invitation", {
    p_org: organization.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !token) return failure(databaseMessage(error));
  refresh();
  return {
    status: "success",
    message: `Einladung für ${parsed.data.email} erstellt. Der Link ist 7 Tage gültig und wird nur jetzt angezeigt.`,
    invitationLink: `${await appOrigin()}/einladung/${token}`,
  };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  await requireUser();
  const invitationId = value(formData, "invitationId");
  if (!uuidSchema.safeParse(invitationId).success) return;
  // RLS erlaubt das Löschen nur Admins der jeweiligen Organisation.
  await (await db()).from("organization_invitations").delete().eq("id", invitationId);
  refresh();
}

export async function changeMemberRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const organization = await getOrganization(value(formData, "organizationId"));
  const role = value(formData, "role");
  const memberId = value(formData, "memberId");
  if (!organization || !uuidSchema.safeParse(memberId).success || !isMemberRole(role)) {
    return failure(GENERIC_ERROR);
  }
  if (!assignableRoles(organization.role).includes(role)) return failure("Diese Rolle darfst du nicht vergeben.");

  const { data, error } = await (await db())
    .from("organization_members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .select("id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure("Dafür fehlt dir die Berechtigung.");
  refresh();
  return { status: "success", message: "Rolle geändert." };
}

export async function removeMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const organization = await getOrganization(value(formData, "organizationId"));
  const memberId = value(formData, "memberId");
  if (!organization || !uuidSchema.safeParse(memberId).success) return failure(GENERIC_ERROR);

  const { data, error } = await (await db())
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .select("user_id");
  if (error) return failure(databaseMessage(error));
  if (data.length === 0) return failure("Dafür fehlt dir die Berechtigung.");
  if (data[0].user_id === user.id) redirect("/analytics");
  refresh();
  return { status: "success", message: "Mitglied entfernt." };
}

export async function acceptInvitationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const token = value(formData, "token");
  await requireUser(`/einladung/${token}`);
  if (!/^[a-f0-9]{48}$/.test(token)) return failure("Die Einladung ist ungültig oder abgelaufen.");
  const { error } = await (await db()).rpc("accept_invitation", { p_token: token });
  if (error) return failure(databaseMessage(error));
  redirect("/analytics");
}
