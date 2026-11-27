import "server-only";
import { createSupabaseServerClient, crmSchema, projectsSchema } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/modules/crm/domain/crm";
import {
  asCategory,
  asPriority,
  asProjectStatus,
  type Priority,
  type ProjectListQuery,
  type ProjectStatus,
  type StatusCategory,
  type TaskListQuery,
  type Visibility,
} from "../domain/projects";

/* Lesezugriffe des Projektmoduls. Sichtbarkeit und Rechte prüft die Datenbank (RLS). */

const db = async () => projectsSchema(await createSupabaseServerClient());

// -----------------------------------------------------------------------------
// Projekte
// -----------------------------------------------------------------------------
export type ProjectRow = {
  id: string;
  number: string;
  name: string;
  status: ProjectStatus;
  visibility: Visibility;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  customerId: string | null;
  leadMemberId: string | null;
  archivedAt: string | null;
  isTemplate: boolean;
  progress: { total: number; done: number; overdue: number };
};

const PROJECT_COLUMNS =
  "id, number, name, description, status, visibility, color, start_date, due_date, budget_hours, customer_id, lead_member_id, is_template, archived_at, created_at";

export const listProjects = async (tenantId: string, query: ProjectListQuery, myMemberId: string | null): Promise<ProjectRow[]> => {
  const client = await db();
  let request = client.from("projects").select(PROJECT_COLUMNS).eq("tenant_id", tenantId).eq("is_template", false);
  request = query.archived ? request.not("archived_at", "is", null) : request.is("archived_at", null);
  if (query.status === "open") request = request.in("status", ["planned", "active", "on_hold"]);
  else if (query.status !== "all") request = request.eq("status", query.status);
  const term = sanitizeSearchTerm(query.q);
  if (term) request = request.or(`name.ilike.%${term}%,number.ilike.%${term}%`);
  if (query.mine) {
    if (!myMemberId) return [];
    const { data: memberships, error } = await client.from("project_members").select("project_id").eq("member_id", myMemberId);
    if (error) throw error;
    request = request.in("id", memberships.map((row) => row.project_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  const [{ data, error }, progressResult] = await Promise.all([
    request.order("due_date", { ascending: true, nullsFirst: false }).order("name").limit(200),
    client.rpc("project_progress", { p_tenant: tenantId }),
  ]);
  if (error) throw error;
  if (progressResult.error) throw progressResult.error;
  const progress = new Map(progressResult.data.map((row) => [row.project_id, { total: row.total, done: row.done, overdue: row.overdue }]));
  return data.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    status: asProjectStatus(row.status),
    visibility: row.visibility === "members" ? "members" : "tenant",
    color: row.color,
    startDate: row.start_date,
    dueDate: row.due_date,
    customerId: row.customer_id,
    leadMemberId: row.lead_member_id,
    archivedAt: row.archived_at,
    isTemplate: row.is_template,
    progress: progress.get(row.id) ?? { total: 0, done: 0, overdue: 0 },
  }));
};

export type ProjectDetail = Omit<ProjectRow, "progress"> & {
  description: string | null;
  budgetHours: number | null;
  createdAt: string;
  /** Rolle der angemeldeten Person im Projekt. */
  myRole: "manager" | "member" | null;
  canEdit: boolean;
  canManage: boolean;
};

export const getProject = async (tenantId: string, projectId: string): Promise<ProjectDetail | null> => {
  const client = await db();
  const { data, error } = await client.from("projects").select(PROJECT_COLUMNS).eq("tenant_id", tenantId).eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [role, canEdit, canManage] = await Promise.all([
    client.rpc("project_role", { p_project: projectId }),
    client.rpc("can_edit", { p_project: projectId }),
    client.rpc("can_manage", { p_project: projectId }),
  ]);
  return {
    id: data.id,
    number: data.number,
    name: data.name,
    description: data.description,
    status: asProjectStatus(data.status),
    visibility: data.visibility === "members" ? "members" : "tenant",
    color: data.color,
    startDate: data.start_date,
    dueDate: data.due_date,
    budgetHours: data.budget_hours === null ? null : Number(data.budget_hours),
    customerId: data.customer_id,
    leadMemberId: data.lead_member_id,
    archivedAt: data.archived_at,
    isTemplate: data.is_template,
    createdAt: data.created_at,
    myRole: role.data === "manager" || role.data === "member" ? role.data : null,
    canEdit: canEdit.data === true,
    canManage: canManage.data === true,
  };
};

export type ProjectMember = { id: string; memberId: string; role: "manager" | "member" };

export const listProjectMembers = async (tenantId: string, projectId: string): Promise<ProjectMember[]> => {
  const { data, error } = await (await db())
    .from("project_members")
    .select("id, member_id, role")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return data.map((row) => ({ id: row.id, memberId: row.member_id, role: row.role === "manager" ? "manager" : "member" }));
};

export type Status = { id: string; name: string; category: StatusCategory; position: number };

export const listStatuses = async (tenantId: string, projectId: string): Promise<Status[]> => {
  const { data, error } = await (await db())
    .from("statuses")
    .select("id, name, category, position")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data.map((row) => ({ id: row.id, name: row.name, category: asCategory(row.category), position: row.position }));
};

export type Milestone = { id: string; name: string; description: string | null; dueDate: string | null; completedAt: string | null };

export const listMilestones = async (tenantId: string, projectId: string): Promise<Milestone[]> => {
  const { data, error } = await (await db())
    .from("milestones")
    .select("id, name, description, due_date, completed_at")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw error;
  return data.map((row) => ({ id: row.id, name: row.name, description: row.description, dueDate: row.due_date, completedAt: row.completed_at }));
};

/** Kunden zur Auswahl (nur mit CRM-Recht sichtbar; sonst leer). */
export const listCustomerOptions = async (tenantId: string): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await crmSchema(await createSupabaseServerClient())
    .from("customers")
    .select("id, number, name")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("name")
    .limit(1000);
  if (error) return [];
  return data.map((row) => ({ id: row.id, label: `${row.name} (${row.number})` }));
};

export const getCustomerName = async (tenantId: string, customerId: string): Promise<string | null> => {
  const { data } = await crmSchema(await createSupabaseServerClient())
    .from("customers")
    .select("name")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();
  return data?.name ?? null;
};

// -----------------------------------------------------------------------------
// Aufgaben
// -----------------------------------------------------------------------------
export type TaskRow = {
  id: string;
  number: number;
  parentId: string | null;
  title: string;
  statusId: string;
  priority: Priority;
  assigneeMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateMinutes: number | null;
  milestoneId: string | null;
  position: number;
  completedAt: string | null;
  subtasks: { total: number; done: number };
};

const TASK_COLUMNS =
  "id, number, parent_id, title, status_id, priority, assignee_member_id, start_date, due_date, estimate_minutes, milestone_id, position, completed_at";

type TaskRecord = {
  id: string;
  number: number;
  parent_id: string | null;
  title: string;
  status_id: string;
  priority: string;
  assignee_member_id: string | null;
  start_date: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  milestone_id: string | null;
  position: number;
  completed_at: string | null;
};

const toTask = (row: TaskRecord, subtasks = { total: 0, done: 0 }): TaskRow => ({
  id: row.id,
  number: row.number,
  parentId: row.parent_id,
  title: row.title,
  statusId: row.status_id,
  priority: asPriority(row.priority),
  assigneeMemberId: row.assignee_member_id,
  startDate: row.start_date,
  dueDate: row.due_date,
  estimateMinutes: row.estimate_minutes,
  milestoneId: row.milestone_id,
  position: row.position,
  completedAt: row.completed_at,
  subtasks,
});

/** Alle Aufgaben eines Projekts (Hauptaufgaben mit Zählung der Unteraufgaben). */
export const listTasks = async (
  tenantId: string,
  projectId: string,
  query: TaskListQuery,
  myMemberId: string | null,
): Promise<TaskRow[]> => {
  const client = await db();
  let request = client.from("tasks").select(TASK_COLUMNS).eq("tenant_id", tenantId).eq("project_id", projectId);
  const term = sanitizeSearchTerm(query.q);
  if (term) request = request.ilike("title", `%${term}%`);
  const { data, error } = await request.order("position").order("number").limit(2000);
  if (error) throw error;

  const subtaskCounts = new Map<string, { total: number; done: number }>();
  for (const row of data) {
    if (!row.parent_id) continue;
    const entry = subtaskCounts.get(row.parent_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.completed_at) entry.done += 1;
    subtaskCounts.set(row.parent_id, entry);
  }
  return data
    .filter((row) => !row.parent_id || term !== "")
    .filter((row) => query.done || !row.completed_at)
    .filter((row) => {
      if (query.assignee === "all") return true;
      if (query.assignee === "none") return row.assignee_member_id === null;
      if (query.assignee === "me") return myMemberId !== null && row.assignee_member_id === myMemberId;
      return row.assignee_member_id === query.assignee;
    })
    .map((row) => toTask(row, subtaskCounts.get(row.id)));
};

export type TaskDetail = TaskRow & {
  projectId: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  subtaskRows: TaskRow[];
  checklist: { id: string; title: string; done: boolean }[];
  dependsOn: { id: string; number: number; title: string; done: boolean }[];
  blocks: { id: string; number: number; title: string; done: boolean }[];
  comments: { id: string; authorId: string | null; body: string; createdAt: string; editedAt: string | null }[];
};

export const getTask = async (tenantId: string, projectId: string, taskId: string): Promise<TaskDetail | null> => {
  const client = await db();
  const { data, error } = await client
    .from("tasks")
    .select(`${TASK_COLUMNS}, description, created_by, created_at`)
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [subtasks, checklist, dependencies, comments] = await Promise.all([
    client.from("tasks").select(TASK_COLUMNS).eq("tenant_id", tenantId).eq("parent_id", taskId).order("position").order("number"),
    client.from("checklist_items").select("id, title, done").eq("tenant_id", tenantId).eq("task_id", taskId).order("position").order("created_at"),
    client
      .from("task_dependencies")
      .select("task_id, depends_on_id")
      .eq("tenant_id", tenantId)
      .or(`task_id.eq.${taskId},depends_on_id.eq.${taskId}`),
    client.from("comments").select("id, author_id, body, created_at, edited_at").eq("tenant_id", tenantId).eq("task_id", taskId).order("created_at"),
  ]);
  for (const result of [subtasks, checklist, dependencies, comments]) if (result.error) throw result.error;

  const relatedIds = [...new Set((dependencies.data ?? []).flatMap((row) => [row.task_id, row.depends_on_id]).filter((id) => id !== taskId))];
  const related = relatedIds.length
    ? await client.from("tasks").select("id, number, title, completed_at").eq("tenant_id", tenantId).in("id", relatedIds)
    : { data: [], error: null };
  if (related.error) throw related.error;
  const byId = new Map((related.data ?? []).map((row) => [row.id, { id: row.id, number: row.number, title: row.title, done: Boolean(row.completed_at) }]));

  return {
    ...toTask(data),
    projectId,
    description: data.description,
    createdBy: data.created_by,
    createdAt: data.created_at,
    subtaskRows: (subtasks.data ?? []).map((row) => toTask(row)),
    checklist: (checklist.data ?? []).map((row) => ({ id: row.id, title: row.title, done: row.done })),
    dependsOn: (dependencies.data ?? []).filter((row) => row.task_id === taskId).flatMap((row) => byId.get(row.depends_on_id) ?? []),
    blocks: (dependencies.data ?? []).filter((row) => row.depends_on_id === taskId).flatMap((row) => byId.get(row.task_id) ?? []),
    comments: (comments.data ?? []).map((row) => ({
      id: row.id,
      authorId: row.author_id,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at,
    })),
  };
};

/** Aufgaben zur Auswahl (z. B. für Abhängigkeiten). */
export const listTaskOptions = async (tenantId: string, projectId: string): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await (await db())
    .from("tasks")
    .select("id, number, title")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("number")
    .limit(2000);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, label: `#${row.number} ${row.title}` }));
};

export const getMyMemberId = async (tenantId: string): Promise<string | null> => {
  const { data } = await (await db()).rpc("my_member_id", { p_tenant: tenantId });
  return typeof data === "string" ? data : null;
};
