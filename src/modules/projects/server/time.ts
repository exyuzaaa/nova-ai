import "server-only";
import { createSupabaseServerClient, projectsSchema } from "@/lib/supabase/server";

/* Zeiteinträge lesen. RLS: eigene Einträge mit projects.time, alle mit projects.time_all. */

const db = async () => projectsSchema(await createSupabaseServerClient());

export type TimeEntry = {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId: string | null;
  taskTitle: string | null;
  taskNumber: number | null;
  memberId: string | null;
  userId: string | null;
  startedAt: string;
  endedAt: string | null;
  minutes: number | null;
  note: string | null;
  billable: boolean;
};

type Filter = { projectId?: string; memberId?: string; from?: string; to?: string; limit?: number };

/** Zeiteinträge im Zeitraum [from, to) (UTC-Zeitpunkte), neueste zuerst. */
export const listTimeEntries = async (tenantId: string, filter: Filter): Promise<TimeEntry[]> => {
  let request = (await db())
    .from("time_entries")
    .select(
      "id, project_id, task_id, member_id, user_id, started_at, ended_at, duration_minutes, note, billable, projects(name, color), tasks(title, number)",
    )
    .eq("tenant_id", tenantId);
  if (filter.projectId) request = request.eq("project_id", filter.projectId);
  if (filter.memberId) request = request.eq("member_id", filter.memberId);
  if (filter.from) request = request.gte("started_at", filter.from);
  if (filter.to) request = request.lt("started_at", filter.to);
  const { data, error } = await request.order("started_at", { ascending: false }).limit(filter.limit ?? 1000);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "–",
    projectColor: row.projects?.color ?? "#64748b",
    taskId: row.task_id,
    taskTitle: row.tasks?.title ?? null,
    taskNumber: row.tasks?.number ?? null,
    memberId: row.member_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    minutes: row.duration_minutes,
    note: row.note,
    billable: row.billable,
  }));
};

/** Laufende Stoppuhr der angemeldeten Person (oder null). */
export const getRunningTimer = async (tenantId: string, memberId: string | null): Promise<TimeEntry | null> => {
  if (!memberId) return null;
  const entries = await listTimeEntries(tenantId, { memberId, limit: 50 });
  return entries.find((entry) => entry.endedAt === null) ?? null;
};

/** Summen nach Schlüssel (Person, Aufgabe …). */
export const sumBy = <K,>(entries: TimeEntry[], key: (entry: TimeEntry) => K): Map<K, number> => {
  const result = new Map<K, number>();
  for (const entry of entries) {
    if (entry.minutes === null) continue;
    result.set(key(entry), (result.get(key(entry)) ?? 0) + entry.minutes);
  }
  return result;
};

/** Projekte zur Auswahl in der Zeiterfassung (laufend, keine Vorlagen). */
export const listTimeProjectOptions = async (tenantId: string): Promise<{ id: string; label: string }[]> => {
  const { data, error } = await (await db())
    .from("projects")
    .select("id, number, name")
    .eq("tenant_id", tenantId)
    .eq("is_template", false)
    .is("archived_at", null)
    .order("name")
    .limit(500);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, label: `${row.name} (${row.number})` }));
};

export type Template = { id: string; number: string; name: string; description: string | null; taskCount: number };

export const listTemplates = async (tenantId: string): Promise<Template[]> => {
  const client = await db();
  const { data, error } = await client
    .from("projects")
    .select("id, number, name, description")
    .eq("tenant_id", tenantId)
    .eq("is_template", true)
    .is("archived_at", null)
    .order("name");
  if (error) throw error;
  const counts = await Promise.all(
    data.map(async (row) => {
      const { count } = await client.from("tasks").select("id", { count: "exact", head: true }).eq("project_id", row.id);
      return count ?? 0;
    }),
  );
  return data.map((row, index) => ({ id: row.id, number: row.number, name: row.name, description: row.description, taskCount: counts[index] }));
};
