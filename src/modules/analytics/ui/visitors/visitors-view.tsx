import { formatRange } from "../../domain/format";
import type { SessionDistribution } from "../../server/data-source";
import type { BreakdownData, DashboardData } from "../../server/queries/dashboard-types";
import { BreakdownTable } from "../components/breakdown-table";
import { DataNotice } from "../components/data-notice";
import { DemoBanner } from "../components/demo-banner";
import { DashboardFilters } from "../dashboard/dashboard-filters";
import { DashboardTransitionProvider, PendingFrame } from "../dashboard/dashboard-transition";
import { KpiOverview, type KpiGroup } from "../dashboard/kpi-overview";

const GROUPS: KpiGroup[] = [
  { label: "Besucher", metrics: ["visitors", "newVisitors", "returningVisitors"] },
  { label: "Engagement", metrics: ["sessions", "avgSessionDuration", "bounceRate"] },
];

const DURATION_LABELS: Record<string, string> = {
  lt10: "unter 10 Sek.",
  "10_30": "10–30 Sek.",
  "30_60": "30–60 Sek.",
  "60_180": "1–3 Min.",
  "180_600": "3–10 Min.",
  gt600: "über 10 Min.",
};
const DEPTH_LABELS: Record<string, string> = { "1": "1 Seite", "2": "2 Seiten", "3_4": "3–4 Seiten", "5_9": "5–9 Seiten", "10p": "10 und mehr" };

const ratio = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const toBreakdown = (rows: { key: string; sessions: number }[], labels: Record<string, string>): BreakdownData => {
  const total = rows.reduce((sum, row) => sum + row.sessions, 0);
  return {
    valueLabel: "Sessions",
    total,
    items: rows.map((row) => ({ key: row.key, label: labels[row.key] ?? row.key, value: row.sessions, share: total > 0 ? row.sessions / total : 0 })),
  };
};

function DistributionCard({ title, summary, data, dimensionLabel }: { title: string; summary: string; data: BreakdownData; dimensionLabel: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{summary}</p>
      </header>
      <BreakdownTable data={data} dimensionLabel={dimensionLabel} emptyText="Keine Sessions im gewählten Zeitraum." />
    </section>
  );
}

/** Besucheranalyse: Reichweite, Engagement und wie lange bzw. wie tief Besucher bleiben. */
export function VisitorsView({ data, distribution }: { data: DashboardData; distribution: SessionDistribution }) {
  const compareLabel = data.compareRange ? (data.compare === "year" ? "Vorjahr" : "Vorperiode") : null;
  const value = (key: string) => data.kpis.find((kpi) => kpi.key === key)?.value ?? null;
  const sessions = value("sessions") ?? 0;
  const visitors = value("visitors") ?? 0;
  const pageviews = value("pageviews") ?? 0;

  return (
    <DashboardTransitionProvider>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Besucher</h1>
            <p className="text-sm text-muted-foreground">{data.site.domain}</p>
          </div>
          <DashboardFilters preset={data.preset} compare={data.compare} range={data.range} compareRange={data.compareRange} />
        </header>
        {data.site.isDemo && <DemoBanner />}
        <PendingFrame className="flex flex-col gap-4">
          <KpiOverview kpis={data.kpis} series={data.series} compareLabel={compareLabel} rangeLabel={formatRange(data.range)} groups={GROUPS} />
          <div className="grid gap-4 lg:grid-cols-2">
            <DistributionCard
              title="Sitzungsdauer"
              summary="Aktive Zeit je Session (sichtbarer Tab mit Interaktion)"
              data={toBreakdown(distribution.duration, DURATION_LABELS)}
              dimensionLabel="Dauer"
            />
            <DistributionCard
              title="Seiten pro Session"
              summary={sessions > 0 ? `Ø ${ratio.format(pageviews / sessions)} Seiten pro Session · Ø ${ratio.format(sessions / Math.max(visitors, 1))} Sessions pro Besucher` : "Noch keine Sessions"}
              data={toBreakdown(distribution.depth, DEPTH_LABELS)}
              dimensionLabel="Seiten"
            />
          </div>
          {!data.availability.newReturning && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-medium">Neue und wiederkehrende Besucher</h2>
              <DataNotice title="Ohne Einwilligung nicht verfügbar">
                Ohne Cookies wechselt die Besucherkennung täglich. Ob jemand schon einmal da war, lässt sich daher nicht
                feststellen. Eindeutige Besucher werden je Tag gezählt.
              </DataNotice>
            </section>
          )}
        </PendingFrame>
      </div>
    </DashboardTransitionProvider>
  );
}
