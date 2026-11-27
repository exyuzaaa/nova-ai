import "server-only";
import { createSupabaseServerClient, crmSchema } from "@/lib/supabase/server";
import { summarizeStage, weightedAmount, type StageKind } from "../domain/crm";

const db = async () => crmSchema(await createSupabaseServerClient());

export type Stage = { id: string; name: string; position: number; probability: number; kind: StageKind };
export type Pipeline = { id: string; name: string; isDefault: boolean; stages: Stage[] };

const asKind = (value: string): StageKind => (value === "won" || value === "lost" ? value : "open");

export const listPipelines = async (tenantId: string): Promise<Pipeline[]> => {
  const client = await db();
  const [pipelines, stages] = await Promise.all([
    client.from("pipelines").select("id, name, is_default, position").eq("tenant_id", tenantId).order("is_default", { ascending: false }).order("position").order("name"),
    client.from("pipeline_stages").select("id, pipeline_id, name, position, probability, kind").eq("tenant_id", tenantId).order("position"),
  ]);
  if (pipelines.error) throw pipelines.error;
  if (stages.error) throw stages.error;
  return pipelines.data.map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    isDefault: pipeline.is_default,
    stages: stages.data
      .filter((stage) => stage.pipeline_id === pipeline.id)
      .map((stage) => ({ id: stage.id, name: stage.name, position: stage.position, probability: stage.probability, kind: asKind(stage.kind) })),
  }));
};

export type BoardCard = {
  id: string;
  number: string;
  title: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  probability: number | null;
  weighted: number;
  expectedCloseDate: string | null;
  ownerMemberId: string | null;
  closedAt: string | null;
};

export type BoardColumn = Stage & { cards: BoardCard[]; summary: { count: number; total: number; weighted: number } };

/**
 * Kanban-Board einer Pipeline. Offene Phasen zeigen alle Chancen, gewonnen/verloren nur
 * die der letzten 90 Tage (ältere bleiben beim Kunden sichtbar).
 */
export const getBoard = async (tenantId: string, pipeline: Pipeline): Promise<BoardColumn[]> => {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await (await db())
    .from("opportunities")
    .select("id, number, title, customer_id, stage_id, amount, currency, probability, expected_close_date, owner_member_id, closed_at, customers(name)")
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", pipeline.id)
    .or(`closed_at.is.null,closed_at.gte.${since}`)
    .order("expected_close_date", { ascending: true, nullsFirst: false })
    .order("created_at")
    .limit(1000);
  if (error) throw error;
  return pipeline.stages.map((stage) => {
    const cards = data
      .filter((row) => row.stage_id === stage.id)
      .map((row) => {
        const amount = Number(row.amount);
        return {
          id: row.id,
          number: row.number,
          title: row.title,
          customerId: row.customer_id,
          customerName: row.customers?.name ?? "",
          amount,
          currency: row.currency,
          probability: row.probability,
          weighted: weightedAmount(amount, stage, row.probability),
          expectedCloseDate: row.expected_close_date,
          ownerMemberId: row.owner_member_id,
          closedAt: row.closed_at,
        };
      });
    return { ...stage, cards, summary: summarizeStage(cards, stage) };
  });
};

export type OpportunityDetail = {
  id: string;
  number: string;
  title: string;
  customerId: string;
  customerName: string;
  pipelineId: string;
  stageId: string;
  amount: number;
  currency: string;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerMemberId: string | null;
  leadId: string | null;
  closedAt: string | null;
  lostReason: string | null;
  notes: string | null;
  createdAt: string;
};

export const getOpportunity = async (tenantId: string, opportunityId: string): Promise<OpportunityDetail | null> => {
  const { data, error } = await (await db())
    .from("opportunities")
    .select(
      "id, number, title, customer_id, pipeline_id, stage_id, amount, currency, probability, expected_close_date, owner_member_id, lead_id, closed_at, lost_reason, notes, created_at, customers(name)",
    )
    .eq("tenant_id", tenantId)
    .eq("id", opportunityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    number: data.number,
    title: data.title,
    customerId: data.customer_id,
    customerName: data.customers?.name ?? "",
    pipelineId: data.pipeline_id,
    stageId: data.stage_id,
    amount: Number(data.amount),
    currency: data.currency,
    probability: data.probability,
    expectedCloseDate: data.expected_close_date,
    ownerMemberId: data.owner_member_id,
    leadId: data.lead_id,
    closedAt: data.closed_at,
    lostReason: data.lost_reason,
    notes: data.notes,
    createdAt: data.created_at,
  };
};

export type SalesSummary = { openCount: number; openTotal: number; weighted: number; wonThisMonth: number; wonCountThisMonth: number };

/** Kennzahlen über alle Pipelines: offener und gewichteter Wert, gewonnen im laufenden Monat (Zeitzone des Unternehmens). */
export const getSalesSummary = async (tenantId: string, monthStartUtc: string): Promise<SalesSummary> => {
  const { data, error } = await (await db())
    .from("opportunities")
    .select("amount, probability, closed_at, pipeline_stages(kind, probability)")
    .eq("tenant_id", tenantId)
    .or(`closed_at.is.null,closed_at.gte.${monthStartUtc}`)
    .limit(5000);
  if (error) throw error;
  const summary: SalesSummary = { openCount: 0, openTotal: 0, weighted: 0, wonThisMonth: 0, wonCountThisMonth: 0 };
  for (const row of data) {
    const stage = { kind: asKind(row.pipeline_stages?.kind ?? "open"), probability: row.pipeline_stages?.probability ?? 0 };
    const amount = Number(row.amount);
    if (stage.kind === "open") {
      summary.openCount += 1;
      summary.openTotal += amount;
      summary.weighted += weightedAmount(amount, stage, row.probability);
    } else if (stage.kind === "won") {
      summary.wonThisMonth += amount;
      summary.wonCountThisMonth += 1;
    }
  }
  summary.weighted = Math.round(summary.weighted * 100) / 100;
  return summary;
};
