import "server-only";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { OPEN_LEAD_STATUSES, PAGE_SIZE, sanitizeSearchTerm, type LeadListQuery } from "../domain/crm";

const db = async () => crmSchema(await createSupabaseServerClient());

export type LeadRow = {
  id: string;
  number: string;
  title: string;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  source: string;
  status: string;
  score: number;
  estimatedValue: number | null;
  ownerMemberId: string | null;
  followUpAt: string | null;
  /** Wiedervorlage liegt in der Vergangenheit (beim Laden berechnet). */
  followUpDue: boolean;
};

export const listLeads = async (tenantId: string, query: LeadListQuery): Promise<{ rows: LeadRow[]; total: number }> => {
  let request = (await db())
    .from("leads")
    .select("id, number, title, company_name, contact_name, email, source, status, score, estimated_value, owner_member_id, follow_up_at", {
      count: "exact",
    })
    .eq("tenant_id", tenantId);
  if (query.status === "open") request = request.in("status", [...OPEN_LEAD_STATUSES]);
  else if (query.status !== "all") request = request.eq("status", query.status);
  if (query.source) request = request.eq("source", query.source);
  if (query.owner) request = request.eq("owner_member_id", query.owner);
  const term = sanitizeSearchTerm(query.q);
  if (term) {
    const pattern = `%${term}%`;
    request = request.or(
      `title.ilike.${pattern},number.ilike.${pattern},company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`,
    );
  }
  // Wiedervorlage: fällige zuerst, ohne Termin ans Ende; Bewertung: beste zuerst; Titel: alphabetisch
  const ordering =
    query.sort === "follow_up_at"
      ? { ascending: true, nullsFirst: false }
      : query.sort === "title"
        ? { ascending: true }
        : { ascending: false };
  const from = (query.page - 1) * PAGE_SIZE;
  const { data, error, count } = await request.order(query.sort, ordering).order("id").range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  const now = new Date().toISOString();
  return {
    total: count ?? 0,
    rows: data.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      companyName: row.company_name,
      contactName: row.contact_name,
      email: row.email,
      source: row.source,
      status: row.status,
      score: row.score,
      estimatedValue: row.estimated_value === null ? null : Number(row.estimated_value),
      ownerMemberId: row.owner_member_id,
      followUpAt: row.follow_up_at,
      followUpDue: Boolean(row.follow_up_at && row.follow_up_at <= now && ["new", "contacted", "qualified"].includes(row.status)),
    })),
  };
};

export type LeadDetail = LeadRow & {
  phone: string | null;
  notes: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  createdAt: string;
};

export const getLead = async (tenantId: string, leadId: string): Promise<LeadDetail | null> => {
  const { data, error } = await (await db())
    .from("leads")
    .select(
      "id, number, title, company_name, contact_name, email, phone, source, status, score, estimated_value, owner_member_id, follow_up_at, notes, converted_customer_id, converted_at, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const now = new Date().toISOString();
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    companyName: data.company_name,
    contactName: data.contact_name,
    email: data.email,
    phone: data.phone,
    source: data.source,
    status: data.status,
    score: data.score,
    estimatedValue: data.estimated_value === null ? null : Number(data.estimated_value),
    ownerMemberId: data.owner_member_id,
    followUpAt: data.follow_up_at,
    followUpDue: Boolean(data.follow_up_at && data.follow_up_at <= now && ["new", "contacted", "qualified"].includes(data.status)),
    notes: data.notes,
    convertedCustomerId: data.converted_customer_id,
    convertedAt: data.converted_at,
    createdAt: data.created_at,
  };
};

export const countOpenLeads = async (tenantId: string): Promise<{ open: number; due: number }> => {
  const client = await db();
  const now = new Date().toISOString();
  const [open, due] = await Promise.all([
    client.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", [...OPEN_LEAD_STATUSES]),
    client
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", [...OPEN_LEAD_STATUSES])
      .lte("follow_up_at", now),
  ]);
  if (open.error) throw open.error;
  if (due.error) throw due.error;
  return { open: open.count ?? 0, due: due.count ?? 0 };
};
