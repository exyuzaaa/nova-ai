"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { CHANNEL_LABELS, DEVICE_LABELS, isTrafficChannel } from "../../domain/channels";
import { formatCount } from "../../domain/format";
import type { RealtimeItem, RealtimeSnapshot } from "../../server/queries/realtime-types";
import type { BreakdownData } from "../../server/queries/dashboard-types";
import { ChartFrame } from "../charts/chart-frame";
import { ChartTooltipCard } from "../charts/chart-tooltip";
import { BreakdownTable } from "../components/breakdown-table";

const REFRESH_MS = 10_000;
const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const regionNames = new Intl.DisplayNames(["de-DE"], { type: "region" });

const EVENT_LABELS: Record<string, string> = {
  outbound_click: "Externer Link",
  download: "Download",
  phone_click: "Telefon-Klick",
  email_click: "E-Mail-Klick",
  form_submit: "Formular abgeschickt",
  form_start: "Formular begonnen",
};

const toBreakdown = (rows: RealtimeItem[], total: number, label: (key: string) => string): BreakdownData => ({
  valueLabel: "Besucher",
  total,
  items: rows.map((row) => ({ key: row.key, label: label(row.key), value: row.visitors, share: total > 0 ? row.visitors / total : 0 })),
});

const minuteLabel = (index: number, length: number) => {
  const ago = length - 1 - index;
  return ago === 0 ? "jetzt" : `vor ${ago} Min.`;
};

function MinuteTooltip({ active, payload }: TooltipContentProps) {
  const datum = payload?.[0]?.payload as { label: string; pageviews: number } | undefined;
  if (!active || !datum) return null;
  return (
    <ChartTooltipCard
      title={datum.label}
      rows={[{ key: "pv", color: "var(--series-1)", value: formatCount(datum.pageviews), label: "Seitenaufrufe", shape: "rect" }]}
    />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{formatCount(value)}</p>
    </div>
  );
}

function ListCard({ title, data, dimensionLabel, mono }: { title: string; data: BreakdownData; dimensionLabel: string; mono?: boolean }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <BreakdownTable data={data} dimensionLabel={dimensionLabel} mono={mono} emptyText="Gerade keine Besucher." />
    </section>
  );
}

/** Echtzeit-Ansicht: lädt alle 10 Sekunden neu, pausiert in Hintergrund-Tabs. */
export function RealtimeView({ siteId, initial }: { siteId: string; initial: RealtimeSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/analytics/realtime/${siteId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setSnapshot((await response.json()) as RealtimeSnapshot);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [siteId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const minutes = snapshot.pageviewsPerMinute.map((pageviews, index, all) => ({
    label: minuteLabel(index, all.length),
    axis: index === all.length - 1 ? "jetzt" : index % 5 === 0 ? `-${all.length - 1 - index}` : "",
    pageviews,
  }));
  const total = Math.max(snapshot.active30m, 1);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="off">
        Aktualisiert um {timeFormat.format(new Date(snapshot.generatedAt))} · alle 10 Sekunden
        {failed && <span className="text-negative"> · Aktualisierung fehlgeschlagen, neuer Versuch folgt</span>}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <section aria-label="Gerade aktiv" className="rounded-xl border bg-card p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">Gerade aktiv</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight" aria-live="polite" data-testid="active-now">
            {formatCount(snapshot.activeNow)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCount(snapshot.active30m)} Besucher in den letzten 30 Minuten
          </p>
        </section>
        <Stat label="Seitenaufrufe (30 Min.)" value={snapshot.pageviews30m} />
        <Stat label="Neue Sessions (30 Min.)" value={snapshot.sessions30m} />
        <Stat label="Events (30 Min.)" value={snapshot.events30m} />
      </div>

      <ChartFrame
        title="Seitenaufrufe pro Minute"
        description="Letzte 30 Minuten"
        chart={
          <figure aria-label="Seitenaufrufe pro Minute in den letzten 30 Minuten" className="m-0">
            <BarChart data={minutes} responsive style={{ width: "100%", height: 200 }} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="axis" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ fill: "var(--chart-ink)", fontSize: 12 }} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-ink)", fontSize: 12 }} width={40} />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(props) => <MinuteTooltip {...props} />} isAnimationActive={false} />
              <Bar dataKey="pageviews" fill="var(--series-1)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </figure>
        }
        table={
          <table className="w-full text-sm">
            <caption className="sr-only">Seitenaufrufe pro Minute</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="py-2 text-left font-medium">Minute</th>
                <th scope="col" className="py-2 text-right font-medium">Seitenaufrufe</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...minutes].reverse().map((minute) => (
                <tr key={minute.label} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal">{minute.label}</th>
                  <td className="py-1.5 text-right">{minute.pageviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Aktuelle Seiten (letzte 5 Min.)"
          dimensionLabel="Seite"
          mono
          data={toBreakdown(snapshot.pages, Math.max(snapshot.pages.reduce((sum, row) => sum + row.visitors, 0), 1), (key) => key)}
        />
        <ListCard
          title="Traffic-Quellen"
          dimensionLabel="Kanal"
          data={toBreakdown(snapshot.channels, total, (key) => (isTrafficChannel(key) ? CHANNEL_LABELS[key] : key))}
        />
        <ListCard
          title="Länder"
          dimensionLabel="Land"
          data={toBreakdown(snapshot.countries, total, (key) => {
            try {
              return regionNames.of(key) ?? key;
            } catch {
              return key;
            }
          })}
        />
        <ListCard title="Geräte" dimensionLabel="Gerät" data={toBreakdown(snapshot.devices, total, (key) => DEVICE_LABELS[key] ?? key)} />
      </div>

      <section aria-label="Letzte Events" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Letzte Events</h2>
        {snapshot.recentEvents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">In den letzten 30 Minuten keine Events außer Seitenaufrufen.</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {snapshot.recentEvents.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{timeFormat.format(new Date(event.at))}</span>
                <span className="font-medium">{event.type === "custom" ? event.name : (EVENT_LABELS[event.type] ?? event.type)}</span>
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{event.path}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
