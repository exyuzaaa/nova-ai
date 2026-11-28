import "server-only";
import { createSupabaseServerClient, financeSchema } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/modules/crm/domain/crm";
import type { DocumentKind, DocumentStatus, PaymentMethod } from "../domain/finance";

/* Lesezugriffe des Finanzmoduls (RLS: finance.view). */

const db = async () => financeSchema(await createSupabaseServerClient());

export type DocumentRow = {
  id: string;
  kind: DocumentKind;
  number: string | null;
  status: DocumentStatus;
  title: string | null;
  recipientName: string | null;
  customerId: string | null;
  issueDate: string | null;
  dueDate: string | null;
  grossTotal: number;
  paidTotal: number;
  createdAt: string;
};

const LIST_COLUMNS = "id, kind, number, status, title, recipient_name, customer_id, issue_date, due_date, gross_total, paid_total, created_at";

type ListRow = {
  id: string;
  kind: string;
  number: string | null;
  status: string;
  title: string | null;
  recipient_name: string | null;
  customer_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  gross_total: number;
  paid_total: number;
  created_at: string;
};

const toRow = (row: ListRow): DocumentRow => ({
  id: row.id,
  kind: row.kind as DocumentKind,
  number: row.number,
  status: row.status as DocumentStatus,
  title: row.title,
  recipientName: row.recipient_name,
  customerId: row.customer_id,
  issueDate: row.issue_date,
  dueDate: row.due_date,
  grossTotal: Number(row.gross_total),
  paidTotal: Number(row.paid_total),
  createdAt: row.created_at,
});

export const listDocuments = async (
  tenantId: string,
  filter: { kind?: DocumentKind; status?: string; q?: string; customerId?: string; projectId?: string },
): Promise<DocumentRow[]> => {
  let request = (await db()).from("documents").select(LIST_COLUMNS).eq("tenant_id", tenantId);
  if (filter.kind) request = request.eq("kind", filter.kind);
  if (filter.status === "open") request = request.in("status", ["issued", "partially_paid", "sent"]);
  else if (filter.status) request = request.eq("status", filter.status);
  if (filter.customerId) request = request.eq("customer_id", filter.customerId);
  if (filter.projectId) request = request.eq("project_id", filter.projectId);
  const term = sanitizeSearchTerm(filter.q ?? "");
  if (term) request = request.or(`number.ilike.%${term}%,recipient_name.ilike.%${term}%,title.ilike.%${term}%`);
  const { data, error } = await request.order("issue_date", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data.map(toRow);
};

export type Line = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineNet: number;
};

export type DocumentDetail = DocumentRow & {
  projectId: string | null;
  quoteId: string | null;
  cancelsId: string | null;
  introText: string | null;
  closingText: string | null;
  recipientExtra: string | null;
  recipientStreet: string | null;
  recipientPostal: string | null;
  recipientCity: string | null;
  recipientCountry: string;
  recipientVatId: string | null;
  serviceDate: string | null;
  serviceEndDate: string | null;
  validUntil: string | null;
  currency: string;
  netTotal: number;
  taxTotal: number;
  taxBreakdown: { rate: number; net: number; tax: number }[];
  seller: Record<string, string | number | boolean | null> | null;
  smallBusiness: boolean;
  cancelReason: string | null;
  lines: Line[];
  payments: { id: string; paidOn: string; amount: number; method: PaymentMethod; note: string | null }[];
  related: { id: string; kind: DocumentKind; number: string | null; status: DocumentStatus }[];
};

export const getDocument = async (tenantId: string, documentId: string): Promise<DocumentDetail | null> => {
  const client = await db();
  const { data, error } = await client.from("documents").select("*").eq("tenant_id", tenantId).eq("id", documentId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [lines, payments, related] = await Promise.all([
    client.from("document_lines").select("*").eq("tenant_id", tenantId).eq("document_id", documentId).order("position").order("created_at"),
    client.from("payments").select("id, paid_on, amount, method, note").eq("tenant_id", tenantId).eq("document_id", documentId).order("paid_on"),
    client
      .from("documents")
      .select("id, kind, number, status")
      .eq("tenant_id", tenantId)
      .or(
        [`quote_id.eq.${documentId}`, `cancels_id.eq.${documentId}`, data.quote_id ? `id.eq.${data.quote_id}` : null, data.cancels_id ? `id.eq.${data.cancels_id}` : null]
          .filter(Boolean)
          .join(","),
      ),
  ]);
  if (lines.error) throw lines.error;
  return {
    ...toRow(data),
    projectId: data.project_id,
    quoteId: data.quote_id,
    cancelsId: data.cancels_id,
    introText: data.intro_text,
    closingText: data.closing_text,
    recipientExtra: data.recipient_extra,
    recipientStreet: data.recipient_street,
    recipientPostal: data.recipient_postal,
    recipientCity: data.recipient_city,
    recipientCountry: data.recipient_country,
    recipientVatId: data.recipient_vat_id,
    serviceDate: data.service_date,
    serviceEndDate: data.service_end_date,
    validUntil: data.valid_until,
    currency: data.currency,
    netTotal: Number(data.net_total),
    taxTotal: Number(data.tax_total),
    taxBreakdown: ((data.tax_breakdown as { rate: number; net: number; tax: number }[] | null) ?? []).map((row) => ({
      rate: Number(row.rate),
      net: Number(row.net),
      tax: Number(row.tax),
    })),
    seller: (data.seller as Record<string, string | number | boolean | null> | null) ?? null,
    smallBusiness: data.small_business,
    cancelReason: data.cancel_reason,
    lines: lines.data.map((line) => ({
      id: line.id,
      position: line.position,
      title: line.title,
      description: line.description,
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice: Number(line.unit_price),
      discountPercent: Number(line.discount_percent),
      taxRate: Number(line.tax_rate),
      lineNet: Number(line.line_net),
    })),
    payments: (payments.data ?? []).map((payment) => ({
      id: payment.id,
      paidOn: payment.paid_on,
      amount: Number(payment.amount),
      method: payment.method as PaymentMethod,
      note: payment.note,
    })),
    related: (related.data ?? []).map((row) => ({ id: row.id, kind: row.kind as DocumentKind, number: row.number, status: row.status as DocumentStatus })),
  };
};

export type Settings = Record<string, string | number | boolean | null>;

export const getSettings = async (tenantId: string): Promise<Settings | null> => {
  const { data } = await (await db()).from("settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return (data as Settings | null) ?? null;
};

export type Article = { id: string; name: string; description: string | null; unit: string; unitPrice: number; taxRate: number; archived: boolean };

export const listArticles = async (tenantId: string, includeArchived = false): Promise<Article[]> => {
  let request = (await db()).from("articles").select("id, name, description, unit, unit_price, tax_rate, archived_at").eq("tenant_id", tenantId);
  if (!includeArchived) request = request.is("archived_at", null);
  const { data, error } = await request.order("name");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    taxRate: Number(row.tax_rate),
    archived: Boolean(row.archived_at),
  }));
};

export type Overview = {
  openCount: number;
  openTotal: number;
  overdueCount: number;
  overdueTotal: number;
  paidMonth: number;
  issuedMonth: number;
  quotesOpen: number;
  quotesOpenTotal: number;
};

export const getOverview = async (tenantId: string, monthStart: string): Promise<Overview> => {
  const { data, error } = await (await db()).rpc("overview", { p_tenant: tenantId, p_month_start: monthStart });
  if (error) throw error;
  const row = data?.[0];
  return {
    openCount: row?.open_count ?? 0,
    openTotal: Number(row?.open_total ?? 0),
    overdueCount: row?.overdue_count ?? 0,
    overdueTotal: Number(row?.overdue_total ?? 0),
    paidMonth: Number(row?.paid_month ?? 0),
    issuedMonth: Number(row?.issued_month ?? 0),
    quotesOpen: row?.quotes_open ?? 0,
    quotesOpenTotal: Number(row?.quotes_open_total ?? 0),
  };
};

// -----------------------------------------------------------------------------
// E-Mail-Versand (Gmail)
// -----------------------------------------------------------------------------
export type MailAccount = { email: string; connectedAt: string; lastUsedAt: string | null; lastError: string | null };

/** Verbundenes Postfach (ohne Token – das ist für Nutzer ohnehin nicht lesbar). */
export const getMailAccount = async (tenantId: string): Promise<MailAccount | null> => {
  const { data, error } = await (await db())
    .from("mail_accounts")
    .select("email, connected_at, last_used_at, last_error")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? { email: data.email, connectedAt: data.connected_at, lastUsedAt: data.last_used_at, lastError: data.last_error } : null;
};

export type DocumentEmail = { id: string; sentFrom: string; recipients: string[]; cc: string[]; subject: string; sentAt: string };

export const listDocumentEmails = async (tenantId: string, documentId: string): Promise<DocumentEmail[]> => {
  const { data, error } = await (await db())
    .from("document_emails")
    .select("id, sent_from, recipients, cc, subject, sent_at")
    .eq("tenant_id", tenantId)
    .eq("document_id", documentId)
    .order("sent_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, sentFrom: row.sent_from, recipients: row.recipients, cc: row.cc, subject: row.subject, sentAt: row.sent_at }));
};
