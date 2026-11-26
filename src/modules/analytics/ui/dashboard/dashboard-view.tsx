import { formatCount, formatPercent, formatRange } from "../../domain/format";
import type { DashboardData } from "../../server/queries/dashboard-types";
import { ChartFrame, LegendLine, LegendSwatch } from "../charts/chart-frame";
import { NewReturningChart } from "../charts/new-returning-chart";
import { SeriesTable } from "../charts/series-table";
import { TimeseriesChart } from "../charts/timeseries-chart";
import { BreakdownCard } from "../components/breakdown-card";
import { BreakdownTable } from "../components/breakdown-table";
import { DataNotice } from "../components/data-notice";
import { DemoBanner } from "../components/demo-banner";
import { SegmentedBar } from "../components/segmented-bar";
import { DashboardFilters } from "./dashboard-filters";
import { DashboardTransitionProvider, PendingFrame } from "./dashboard-transition";
import { KpiOverview } from "./kpi-overview";

export function DashboardView({ data }: { data: DashboardData }) {
  const compareLabel = data.compareRange ? (data.compare === "year" ? "Vorjahr" : "Vorperiode") : null;
  const rangeLabel = formatRange(data.range);
  const hasPrevious = data.compareRange !== null;

  const visitorsKpi = data.kpis.find((kpi) => kpi.key === "visitors");
  const newKpi = data.kpis.find((kpi) => kpi.key === "newVisitors");
  const returningKpi = data.kpis.find((kpi) => kpi.key === "returningVisitors");
  const newReturningAvailable = newKpi?.value != null && returningKpi?.value != null;
  const visitorTotal = visitorsKpi?.value ?? 0;

  return (
    <DashboardTransitionProvider>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <header className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">{data.site.domain}</p>
          </div>
          <DashboardFilters
            preset={data.preset}
            compare={data.compare}
            range={data.range}
            compareRange={data.compareRange}
          />
        </header>

        {data.site.isDemo && <DemoBanner />}

        <PendingFrame className="flex flex-col gap-4">
          <KpiOverview kpis={data.kpis} series={data.series} compareLabel={compareLabel} rangeLabel={rangeLabel} />

          <div className="grid gap-4 lg:grid-cols-2">
            {newReturningAvailable ? (
              <ChartFrame
                title="Neue vs. wiederkehrende Besucher"
                description={
                  visitorTotal > 0
                    ? `${formatCount(newKpi!.value!)} neu (${formatPercent(newKpi!.value! / visitorTotal)}) · ${formatCount(returningKpi!.value!)} wiederkehrend`
                    : undefined
                }
                legend={
                  <div className="flex flex-wrap gap-4">
                    <LegendSwatch color="var(--series-1)" label="Neue Besucher" />
                    <LegendSwatch color="var(--series-2)" label="Wiederkehrende Besucher" />
                  </div>
                }
                chart={<NewReturningChart points={data.series} />}
                table={<SeriesTable points={data.series} metrics={["newVisitors", "returningVisitors"]} />}
              />
            ) : (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <h2 className="text-sm font-medium">Neue vs. wiederkehrende Besucher</h2>
                <DataNotice title="Ohne Einwilligung nicht verfügbar">
                  Im cookielosen Modus lässt sich nicht feststellen, ob jemand schon einmal da war. Diese Kennzahl wird
                  mit dem Einwilligungsmodus verfügbar.
                </DataNotice>
              </section>
            )}

            {!data.availability.conversions ? (
              <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <h2 className="text-sm font-medium">Conversion-Entwicklung</h2>
                <DataNotice title="Noch keine Conversion-Ziele">
                  Sobald Ziele wie „Kontaktformular abgeschickt“ angelegt sind, erscheinen hier Conversion Rate und
                  erreichte Ziele. Die Zielverwaltung folgt mit dem Conversion-Tracking.
                </DataNotice>
              </section>
            ) : (
            <ChartFrame
              title="Conversion-Entwicklung"
              description="Conversion Rate im Verlauf und erreichte Ziele im Zeitraum"
              legend={
                hasPrevious ? (
                  <div className="flex flex-wrap gap-4">
                    <LegendLine color="var(--series-1)" label={rangeLabel} />
                    <LegendLine color="var(--chart-compare)" label={compareLabel ?? "Vergleich"} />
                  </div>
                ) : null
              }
              chart={
                <div className="flex flex-col gap-4">
                  <TimeseriesChart points={data.series} metric="conversionRate" height={180} />
                  <BreakdownTable data={data.breakdowns.goals} dimensionLabel="Ziel" />
                </div>
              }
              table={
                <div className="flex flex-col gap-4">
                  <SeriesTable points={data.series} metrics={["conversionRate"]} />
                  <BreakdownTable data={data.breakdowns.goals} dimensionLabel="Ziel" />
                </div>
              }
            />
            )}

            <BreakdownCard
              title="Traffic nach Quelle"
              tabs={[
                { value: "channels", label: "Kanäle", dimensionLabel: "Kanal", data: data.breakdowns.channels },
                { value: "sources", label: "Quellen", dimensionLabel: "Quelle", data: data.breakdowns.sources },
              ]}
            />

            <BreakdownCard
              title="Beliebteste Seiten"
              tabs={[
                { value: "pages", label: "Seiten", dimensionLabel: "Seite", data: data.breakdowns.pages, mono: true },
                {
                  value: "entry",
                  label: "Einstiegsseiten",
                  dimensionLabel: "Einstiegsseite",
                  data: data.breakdowns.entryPages,
                  mono: true,
                },
              ]}
            />

            <BreakdownCard
              title="Top-Länder"
              tabs={[{ value: "countries", label: "Länder", dimensionLabel: "Land", data: data.breakdowns.countries }]}
            />

            <BreakdownCard
              title="Geräteverteilung"
              header={<SegmentedBar items={data.breakdowns.devices.items} label="Geräteverteilung" />}
              tabs={[
                { value: "devices", label: "Geräte", dimensionLabel: "Gerät", data: data.breakdowns.devices },
                { value: "browsers", label: "Browser", dimensionLabel: "Browser", data: data.breakdowns.browsers },
                {
                  value: "os",
                  label: "Betriebssysteme",
                  dimensionLabel: "Betriebssystem",
                  data: data.breakdowns.operatingSystems,
                },
              ]}
            />
          </div>
        </PendingFrame>
      </div>
    </DashboardTransitionProvider>
  );
}
