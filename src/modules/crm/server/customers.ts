import "server-only";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { PAGE_SIZE, sanitizeSearchTerm, type CustomerListQuery } from "../domain/crm";

const db = async () => crmSchema(await createSupabaseServerClient());

export type CustomerRow = {
  id: string;
  number: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  tags: string[];
  ownerMemberId: string | null;
  updatedAt: string;
  archivedAt: string | null;
};

/** Kundenliste mit Suche, Filtern, Sortierung und Seiten (RLS: nur eigenes Unternehmen, nur mit crm.view). */
export const listCustomers = async (tenantId: string, query: CustomerListQuery): Promise<{ rows: CustomerRow[]; total: number }> => {
  let request = (await db())
    .from("customers")
    .select("id, number, kind, name, email, phone, city, status, tags, owner_member_id, updated_at, archived_at", { count: "exact" })
    .eq("tenant_id", tenantId);
  request = query.archived ? request.not("archived_at", "is", null) : request.is("archived_at", null);
  if (query.status) request = request.eq("status", query.status);
  if (query.owner) request = request.eq("owner_member_id", query.owner);
  const term = sanitizeSearchTerm(query.q);
  if (term) {
    const pattern = `%${term}%`;
    request = request.or(`name.ilike.${pattern},number.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`);
  }
  const from = (query.page - 1) * PAGE_SIZE;
  // Datumsspalten: neueste zuerst; Name und Nummer: aufsteigend (umkehrbar mit richtung=ab)
  const ascending = query.sort === "name" || query.sort === "number" ? !query.descending : false;
  const { data, error, count } = await request
    .order(query.sort, { ascending })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return {
    total: count ?? 0,
    rows: data.map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,
      status: row.status,
      tags: row.tags,
      ownerMemberId: row.owner_member_id,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    })),
  };
};

export type CustomerDetail = {
  id: string;
  number: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  vatId: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  status: string;
  category: string | null;
  tags: string[];
  description: string | null;
  ownerMemberId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export const getCustomer = async (tenantId: string, customerId: string): Promise<CustomerDetail | null> => {
  const { data, error } = await (await db())
    .from("customers")
    .select(
      "id, number, kind, name, email, phone, website, vat_id, street, postal_code, city, country_code, status, category, tags, description, owner_member_id, created_at, updated_at, archived_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    number: data.number,
    kind: data.kind,
    name: data.name,
    email: data.email,
    phone: data.phone,
    website: data.website,
    vatId: data.vat_id,
    street: data.street,
    postalCode: data.postal_code,
    city: data.city,
    countryCode: data.country_code,
    status: data.status,
    category: data.category,
    tags: data.tags,
    description: data.description,
    ownerMemberId: data.owner_member_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    archivedAt: data.archived_at,
  };
};

export type Contact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export const contactName = (contact: Pick<Contact, "firstName" | "lastName">) =>
  [contact.firstName, contact.lastName].filter(Boolean).join(" ");

export const listContacts = async (tenantId: string, customerId: string): Promise<Contact[]> => {
  const { data, error } = await (await db())
    .from("contacts")
    .select("id, first_name, last_name, position, email, phone, is_primary")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("last_name");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    email: row.email,
    phone: row.phone,
    isPrimary: row.is_primary,
  }));
};

export type Activity = {
  id: string;
  kind: string;
  subject: string;
  body: string | null;
  dueAt: string | null;
  doneAt: string | null;
  assignedMemberId: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Offene Aufgabe mit Fälligkeit in der Vergangenheit (beim Laden berechnet). */
  overdue: boolean;
};

/** Aktivitäten eines Kunden, Leads oder einer Verkaufschance (neueste zuerst, offene Aufgaben oben). */
export const listActivities = async (
  tenantId: string,
  target: { customerId?: string; leadId?: string; opportunityId?: string },
  limit = 100,
): Promise<Activity[]> => {
  let request = (await db())
    .from("activities")
    .select("id, kind, subject, body, due_at, done_at, assigned_member_id, created_by, created_at")
    .eq("tenant_id", tenantId);
  if (target.customerId) request = request.eq("customer_id", target.customerId);
  if (target.leadId) request = request.eq("lead_id", target.leadId);
  if (target.opportunityId) request = request.eq("opportunity_id", target.opportunityId);
  const { data, error } = await request.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const now = new Date().toISOString();
  const rows = data.map((row) => ({
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    body: row.body,
    dueAt: row.due_at,
    doneAt: row.done_at,
    assignedMemberId: row.assigned_member_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    overdue: row.kind === "task" && !row.done_at && Boolean(row.due_at && row.due_at < now),
  }));
  const openTask = (activity: Activity) => activity.kind === "task" && !activity.doneAt;
  return [...rows.filter(openTask).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")), ...rows.filter((row) => !openTask(row))];
};

export type DuplicateCandidate = { id: string; number: string; name: string; email: string | null; reason: string };

export const findDuplicates = async (tenantId: string, name: string, email: string | null, excludeId?: string): Promise<DuplicateCandidate[]> => {
  const { data, error } = await (await db()).rpc("find_duplicates", {
    p_tenant: tenantId,
    p_name: name,
    p_email: email ?? undefined,
    p_exclude: excludeId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, number: row.number, name: row.name, email: row.email, reason: row.reason }));
};

export type OpportunitySummary = { id: string; number: string; title: string; amount: number; currency: string; stageName: string; stageKind: string };

export const listCustomerOpportunities = async (tenantId: string, customerId: string): Promise<OpportunitySummary[]> => {
  const { data, error } = await (await db())
    .from("opportunities")
    .select("id, number, title, amount, currency, pipeline_stages(name, kind)")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    amount: Number(row.amount),
    currency: row.currency,
    stageName: row.pipeline_stages?.name ?? "",
    stageKind: row.pipeline_stages?.kind ?? "open",
  }));
};
