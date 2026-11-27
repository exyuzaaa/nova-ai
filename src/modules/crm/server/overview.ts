import "server-only";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";

export type CrmOverview = {
  customers: number;
  prospects: number;
  openTasks: number;
  overdueTasks: number;
  upcomingTasks: { id: string; subject: string; dueAt: string; overdue: boolean; customerId: string | null; leadId: string | null; opportunityId: string | null }[];
  recentCustomers: { id: string; number: string; name: string; createdAt: string }[];
};

/** Kennzahlen für die CRM-Übersicht (alles per RLS auf das Unternehmen beschränkt). */
export const getCrmOverview = async (tenantId: string): Promise<CrmOverview> => {
  const db = crmSchema(await createSupabaseServerClient());
  const now = new Date().toISOString();
  const head = { count: "exact" as const, head: true };
  const [customers, prospects, openTasks, overdue, upcoming, recent] = await Promise.all([
    db.from("customers").select("id", head).eq("tenant_id", tenantId).is("archived_at", null),
    db.from("customers").select("id", head).eq("tenant_id", tenantId).is("archived_at", null).eq("status", "prospect"),
    db.from("activities").select("id", head).eq("tenant_id", tenantId).eq("kind", "task").is("done_at", null),
    db.from("activities").select("id", head).eq("tenant_id", tenantId).eq("kind", "task").is("done_at", null).lt("due_at", now),
    db
      .from("activities")
      .select("id, subject, due_at, customer_id, lead_id, opportunity_id")
      .eq("tenant_id", tenantId)
      .eq("kind", "task")
      .is("done_at", null)
      .order("due_at")
      .limit(8),
    db.from("customers").select("id, number, name, created_at").eq("tenant_id", tenantId).is("archived_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  for (const result of [customers, prospects, openTasks, overdue, upcoming, recent]) if (result.error) throw result.error;
  return {
    customers: customers.count ?? 0,
    prospects: prospects.count ?? 0,
    openTasks: openTasks.count ?? 0,
    overdueTasks: overdue.count ?? 0,
    upcomingTasks: (upcoming.data ?? []).flatMap((row) =>
      row.due_at
        ? [{ id: row.id, subject: row.subject, dueAt: row.due_at, overdue: row.due_at < now, customerId: row.customer_id, leadId: row.lead_id, opportunityId: row.opportunity_id }]
        : [],
    ),
    recentCustomers: (recent.data ?? []).map((row) => ({ id: row.id, number: row.number, name: row.name, createdAt: row.created_at })),
  };
};
