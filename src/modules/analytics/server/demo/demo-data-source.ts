/**
 * DEMO-DATENQUELLE – erzeugt synthetische, deterministische Beispieldaten.
 *
 * Darf ausschließlich für Websites mit isDemo = true verwendet werden
 * (erzwungen in ../data-source-factory.ts). Die Oberfläche kennzeichnet diese
 * Daten dauerhaft als „Demo-Daten“.
 *
 * Die Werte sind in sich konsistent: Aufschlüsselungen summieren sich je Tag
 * exakt auf die Tageswerte, Verhältnisse entstehen aus denselben Bausteinen wie
 * später bei echten Daten.
 */
import type { DateRange, Granularity, IsoDate } from "../../domain/date-range";
import { bucketsFor, enumerateDays, rangeLength } from "../../domain/date-range";
import { emptyTotals, type Totals } from "../../domain/metrics";
import {
  ALL_CAPABILITIES,
  type AnalyticsDataSource,
  DEPTH_BUCKETS,
  DURATION_BUCKETS,
  type BreakdownDimension,
  type SessionDistribution,
  type BreakdownRow,
  type TimeseriesPoint,
} from "../data-source";

type Weights = Record<string, number>;

const CHANNEL_WEIGHTS: Weights = {
  organic_search: 0.37,
  direct: 0.24,
  paid_search: 0.12,
  social: 0.09,
  referral: 0.08,
  email: 0.05,
  display: 0.03,
  unassigned: 0.02,
};

const SOURCES_BY_CHANNEL: Record<string, Weights> = {
  organic_search: { Google: 0.86, Bing: 0.08, DuckDuckGo: 0.04, Ecosia: 0.02 },
  direct: { "(direkt)": 1 },
  paid_search: { "Google Ads": 0.88, "Microsoft Ads": 0.12 },
  social: { LinkedIn: 0.46, Instagram: 0.28, Facebook: 0.16, XING: 0.1 },
  referral: { "wikipedia.org": 0.4, "gelbeseiten.de": 0.35, "presseportal.de": 0.25 },
  email: { Newsletter: 1 },
  display: { "Google Display": 1 },
  unassigned: { "(nicht zugeordnet)": 1 },
};

const PAGE_WEIGHTS: Weights = {
  "/": 0.27,
  "/leistungen": 0.14,
  "/preise": 0.11,
  "/kontakt": 0.08,
  "/blog/website-analyse-dsgvo": 0.08,
  "/referenzen": 0.06,
  "/ueber-uns": 0.06,
  "/blog/conversion-rate-steigern": 0.05,
  "/termin-buchen": 0.05,
  "/karriere": 0.04,
  "/datenschutz": 0.03,
  "/impressum": 0.03,
};

const ENTRY_PAGE_WEIGHTS: Weights = {
  "/": 0.44,
  "/blog/website-analyse-dsgvo": 0.14,
  "/leistungen": 0.12,
  "/preise": 0.09,
  "/blog/conversion-rate-steigern": 0.08,
  "/kontakt": 0.05,
  "/referenzen": 0.04,
  "/karriere": 0.04,
};

const COUNTRY_WEIGHTS: Weights = {
  DE: 0.78,
  AT: 0.08,
  CH: 0.07,
  NL: 0.016,
  US: 0.014,
  GB: 0.011,
  FR: 0.009,
  PL: 0.008,
  IT: 0.007,
  ES: 0.005,
};

const DEVICE_WEIGHTS: Weights = { desktop: 0.58, mobile: 0.38, tablet: 0.04 };

const BROWSER_WEIGHTS: Weights = {
  Chrome: 0.52,
  Safari: 0.26,
  Edge: 0.09,
  Firefox: 0.08,
  "Samsung Internet": 0.03,
  Sonstige: 0.02,
};

const OS_WEIGHTS: Weights = {
  Windows: 0.41,
  iOS: 0.23,
  Android: 0.18,
  macOS: 0.14,
  Linux: 0.03,
  Sonstige: 0.01,
};

const GOALS: { key: string; label: string; weight: number }[] = [
  { key: "contact_form_submitted", label: "Kontaktformular abgeschickt", weight: 0.4 },
  { key: "phone_click", label: "Telefonnummer angeklickt", weight: 0.24 },
  { key: "appointment_booked", label: "Termin gebucht", weight: 0.2 },
  { key: "chatbot_started", label: "Chatbot gestartet", weight: 0.16 },
];
const GOAL_LABELS = Object.fromEntries(GOALS.map((goal) => [goal.key, goal.label]));

/** Wochentagsfaktoren (Index = getUTCDay, 0 = Sonntag) – typisches B2B-Muster. */
const WEEKDAY_FACTOR = [0.64, 1.08, 1.1, 1.06, 1.02, 0.9, 0.58];
/** Saisonfaktoren je Monat (Sommer- und Jahresendloch). */
const MONTH_FACTOR = [0.94, 0.98, 1.02, 1.03, 1.0, 0.97, 0.9, 0.86, 1.0, 1.04, 1.06, 0.88];
const BASE_VISITORS = 820;
const TREND_EPOCH = Date.UTC(2024, 0, 1);

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------
const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const createRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Random = ReturnType<typeof createRandom>;

const jitter = (random: Random, spread: number) => 1 - spread + random() * spread * 2;

/** Ganzzahlige Aufteilung nach Gewichten; Summe entspricht exakt `total` (Largest Remainder). */
export const allocate = (total: number, weights: Weights, random?: Random): Record<string, number> => {
  const entries = Object.entries(weights).map(([key, weight]) => [
    key,
    random ? weight * jitter(random, 0.2) : weight,
  ]) as [string, number][];
  const weightSum = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const exact = entries.map(([key, weight]) => ({ key, value: (total * weight) / weightSum }));
  const result: Record<string, number> = {};
  let assigned = 0;
  for (const { key, value } of exact) {
    result[key] = Math.floor(value);
    assigned += result[key];
  }
  const byRemainder = [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)),
  );
  for (let index = 0; index < total - assigned; index += 1) {
    result[byRemainder[index % byRemainder.length].key] += 1;
  }
  return result;
};

// ---------------------------------------------------------------------------
// Tagesdaten
// ---------------------------------------------------------------------------
type DimensionMap = Map<string, BreakdownRow>;

type DayFacts = {
  totals: Totals;
  dimensions: Record<BreakdownDimension, DimensionMap>;
};

const toRows = (
  values: Record<string, number>,
  field: "visitors" | "pageviews" | "conversions",
): DimensionMap => {
  const map: DimensionMap = new Map();
  for (const [key, value] of Object.entries(values)) {
    map.set(key, { key, visitors: 0, pageviews: 0, conversions: 0, [field]: value });
  }
  return map;
};

const buildDay = (siteId: string, day: IsoDate): DayFacts => {
  const random = createRandom(hashString(`${siteId}:${day}`));
  const date = new Date(`${day}T00:00:00Z`);
  const daysSinceEpoch = (date.getTime() - TREND_EPOCH) / 86_400_000;
  const growth = 1 + 0.00045 * daysSinceEpoch;
  const dayOfMonth = date.getUTCDate();
  const newsletterBoost = dayOfMonth <= 2 ? 1.06 : 1;

  const visitors = Math.round(
    BASE_VISITORS *
      growth *
      WEEKDAY_FACTOR[date.getUTCDay()] *
      MONTH_FACTOR[date.getUTCMonth()] *
      newsletterBoost *
      jitter(random, 0.1),
  );
  const newVisitors = Math.round(visitors * (0.62 + random() * 0.1));
  const sessions = Math.round(visitors * (1.12 + random() * 0.1));
  const pageviews = Math.round(sessions * (2.35 + random() * 0.5));
  const bounces = Math.round(sessions * (0.36 + random() * 0.1));
  const engagementMs = Math.round(sessions * (85 + random() * 35) * 1000);
  const convertedSessions = Math.round(sessions * (0.022 + random() * 0.014));
  const conversions = convertedSessions + Math.round(convertedSessions * 0.15 * random());
  const leads = Math.round(convertedSessions * (0.5 + random() * 0.2));

  const channelWeights = { ...CHANNEL_WEIGHTS, email: CHANNEL_WEIGHTS.email * (dayOfMonth <= 2 ? 4 : 1) };
  const channelVisitors = allocate(visitors, channelWeights, random);
  const sourceVisitors: Record<string, number> = {};
  for (const [channel, channelTotal] of Object.entries(channelVisitors)) {
    const perSource = allocate(channelTotal, SOURCES_BY_CHANNEL[channel], random);
    for (const [source, count] of Object.entries(perSource)) {
      sourceVisitors[source] = (sourceVisitors[source] ?? 0) + count;
    }
  }

  const pagePageviews = allocate(pageviews, PAGE_WEIGHTS, random);
  const pages: DimensionMap = new Map();
  for (const [page, views] of Object.entries(pagePageviews)) {
    const pageVisitors = Math.min(visitors, Math.round(views * (0.7 + random() * 0.15)));
    pages.set(page, { key: page, visitors: pageVisitors, pageviews: views, conversions: 0 });
  }

  const goalConversions = allocate(
    conversions,
    Object.fromEntries(GOALS.map((goal) => [goal.key, goal.weight])),
    random,
  );

  return {
    totals: {
      visitors,
      newVisitors,
      returningVisitors: visitors - newVisitors,
      sessions,
      pageviews,
      bounces,
      engagementMs,
      convertedSessions,
      conversions,
      leads,
    },
    dimensions: {
      channel: toRows(channelVisitors, "visitors"),
      source: toRows(sourceVisitors, "visitors"),
      page: pages,
      entry_page: toRows(allocate(visitors, ENTRY_PAGE_WEIGHTS, random), "visitors"),
      country: toRows(allocate(visitors, COUNTRY_WEIGHTS, random), "visitors"),
      device: toRows(allocate(visitors, DEVICE_WEIGHTS, random), "visitors"),
      browser: toRows(allocate(visitors, BROWSER_WEIGHTS, random), "visitors"),
      os: toRows(allocate(visitors, OS_WEIGHTS, random), "visitors"),
      goal: toRows(goalConversions, "conversions"),
    },
  };
};

const dayCache = new Map<string, DayFacts>();
const MAX_CACHE_ENTRIES = 5_000;

const getDay = (siteId: string, day: IsoDate): DayFacts => {
  const cacheKey = `${siteId}:${day}`;
  const cached = dayCache.get(cacheKey);
  if (cached) return cached;
  if (dayCache.size >= MAX_CACHE_ENTRIES) dayCache.clear();
  const facts = buildDay(siteId, day);
  dayCache.set(cacheKey, facts);
  return facts;
};

/**
 * Wiederkehrende Besucher kommen an mehreren Tagen; über längere Zeiträume
 * zählen sie nur einmal. Neue Besucher sind per Definition additiv.
 */
export const returningDedupeFactor = (days: number): number =>
  days <= 1 ? 1 : 1 / Math.pow(1 + 0.08 * (days - 1), 0.55);

const aggregateRange = (siteId: string, range: DateRange): { totals: Totals; visitorScale: number } => {
  const sum = emptyTotals();
  let dailyVisitors = 0;
  let dailyReturning = 0;
  for (const day of enumerateDays(range)) {
    const { totals } = getDay(siteId, day);
    dailyVisitors += totals.visitors;
    dailyReturning += totals.returningVisitors ?? 0;
    sum.newVisitors = (sum.newVisitors ?? 0) + (totals.newVisitors ?? 0);
    sum.sessions += totals.sessions;
    sum.pageviews += totals.pageviews;
    sum.bounces += totals.bounces;
    sum.engagementMs += totals.engagementMs;
    sum.convertedSessions += totals.convertedSessions;
    sum.conversions += totals.conversions;
    sum.leads += totals.leads;
  }
  const returningVisitors = Math.round(dailyReturning * returningDedupeFactor(rangeLength(range)));
  const visitors = (sum.newVisitors ?? 0) + returningVisitors;
  return {
    totals: { ...sum, visitors, returningVisitors },
    visitorScale: dailyVisitors > 0 ? visitors / dailyVisitors : 0,
  };
};

export const demoDataSource: AnalyticsDataSource = {
  kind: "demo",
  capabilities: ALL_CAPABILITIES,

  async getTotals(siteId, range) {
    return aggregateRange(siteId, range).totals;
  },

  async getTimeseries(siteId, range, granularity: Granularity): Promise<TimeseriesPoint[]> {
    return bucketsFor(range, granularity).map((bucket) => ({
      bucket: bucket.key,
      range: bucket.range,
      totals: aggregateRange(siteId, bucket.range).totals,
    }));
  },

  async getBreakdown(siteId, range, dimension, { limit }) {
    const { visitorScale } = aggregateRange(siteId, range);
    const merged = new Map<string, BreakdownRow>();
    for (const day of enumerateDays(range)) {
      for (const row of getDay(siteId, day).dimensions[dimension].values()) {
        const target = merged.get(row.key) ?? { key: row.key, visitors: 0, pageviews: 0, conversions: 0 };
        target.visitors += row.visitors;
        target.pageviews += row.pageviews;
        target.conversions += row.conversions;
        merged.set(row.key, target);
      }
    }
    const sortField = dimension === "goal" ? "conversions" : dimension === "page" ? "pageviews" : "visitors";
    return Array.from(merged.values())
      .map((row) => ({
        ...row,
        label: dimension === "goal" ? GOAL_LABELS[row.key] : undefined,
        visitors: Math.round(row.visitors * visitorScale),
      }))
      .sort((a, b) => b[sortField] - a[sortField])
      .slice(0, limit);
  },

  async getSessionDistribution(siteId, range): Promise<SessionDistribution> {
    const { totals } = aggregateRange(siteId, range);
    const duration = allocate(totals.sessions, { lt10: 0.38, "10_30": 0.17, "30_60": 0.14, "60_180": 0.17, "180_600": 0.1, gt600: 0.04 });
    const depth = allocate(totals.sessions, { "1": 0.41, "2": 0.23, "3_4": 0.2, "5_9": 0.12, "10p": 0.04 });
    return {
      duration: DURATION_BUCKETS.map((key) => ({ key, sessions: duration[key] })),
      depth: DEPTH_BUCKETS.map((key) => ({ key, sessions: depth[key] })),
    };
  },
};
