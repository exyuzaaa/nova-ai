import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { uuidSchema } from "@/modules/core/domain/tenant-validation";
import { requireTenantContext } from "@/modules/core/server/tenant-context";
import { listMembers } from "@/modules/core/server/tenants";
import { getMyMemberId, getProject } from "./projects";

/** Unternehmen + Projekt für /projekte/[projectId] (404, wenn unsichtbar oder unbekannt). */
export const loadProjectContext = cache(async (slug: string, projectId: string) => {
  const context = await requireTenantContext(slug, "projects.view");
  if (!uuidSchema.safeParse(projectId).success) notFound();
  const [project, members, myMemberId] = await Promise.all([
    getProject(context.tenant.id, projectId),
    listMembers(context.tenant.id),
    getMyMemberId(context.tenant.id),
  ]);
  if (!project) notFound();
  const memberNames = new Map(members.map((member) => [member.memberId, member.email]));
  return { ...context, project, members, memberNames, myMemberId };
});
