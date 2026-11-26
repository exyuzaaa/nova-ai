/**
 * Navigation von NOVA ANALYTICS (17 Bereiche laut Briefing).
 * `availableFrom` = Phase, ab der der Bereich echte Funktion hat. Bereiche ohne
 * Funktion werden ausgeblendet – es gibt keine optischen Platzhalter.
 */
export const CURRENT_PHASE = 3;

export type NavIcon =
  | "dashboard"
  | "realtime"
  | "visitors"
  | "pages"
  | "sources"
  | "locations"
  | "devices"
  | "paths"
  | "events"
  | "goals"
  | "funnels"
  | "campaigns"
  | "leads"
  | "reports"
  | "integrations"
  | "privacy"
  | "settings";

export type NavItem = {
  id: NavIcon;
  label: string;
  /** Pfadsegment unterhalb von /analytics/[siteId]; "" = Dashboard. */
  segment: string;
  availableFrom: number;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAVIGATION: NavGroup[] = [
  {
    label: "Übersicht",
    items: [
      { id: "dashboard", label: "Dashboard", segment: "", availableFrom: 2 },
      { id: "realtime", label: "Echtzeit", segment: "realtime", availableFrom: 6 },
    ],
  },
  {
    label: "Zielgruppe",
    items: [
      { id: "visitors", label: "Besucher", segment: "visitors", availableFrom: 6 },
      { id: "locations", label: "Länder und Regionen", segment: "locations", availableFrom: 7 },
      { id: "devices", label: "Geräte und Browser", segment: "devices", availableFrom: 7 },
    ],
  },
  {
    label: "Verhalten",
    items: [
      { id: "pages", label: "Seitenanalyse", segment: "pages", availableFrom: 7 },
      { id: "paths", label: "Besucherpfade", segment: "paths", availableFrom: 7 },
      { id: "events", label: "Events", segment: "events", availableFrom: 8 },
    ],
  },
  {
    label: "Akquisition",
    items: [
      { id: "sources", label: "Traffic-Quellen", segment: "sources", availableFrom: 7 },
      { id: "campaigns", label: "Kampagnen", segment: "campaigns", availableFrom: 9 },
    ],
  },
  {
    label: "Conversions",
    items: [
      { id: "goals", label: "Conversion-Ziele", segment: "goals", availableFrom: 8 },
      { id: "funnels", label: "Conversion-Funnels", segment: "funnels", availableFrom: 9 },
      { id: "leads", label: "Leads", segment: "leads", availableFrom: 9 },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { id: "reports", label: "Berichte", segment: "reports", availableFrom: 10 },
      { id: "integrations", label: "Integrationen", segment: "integrations", availableFrom: 9 },
      { id: "privacy", label: "Datenschutz", segment: "privacy", availableFrom: 12 },
      { id: "settings", label: "Einstellungen", segment: "settings", availableFrom: 3 },
    ],
  },
];

export const ALL_NAV_ITEMS = NAVIGATION.flatMap((group) => group.items);

/** Bereiche, die für die Demo-Website keinen Sinn ergeben (Verwaltung echter Websites). */
const MANAGEMENT_ITEMS: NavIcon[] = ["settings", "integrations", "privacy", "reports"];

/** Nur Bereiche mit echter Funktion in der aktuellen Phase. */
export const visibleNavigation = (
  phase: number = CURRENT_PHASE,
  options: { isDemo?: boolean } = {},
): NavGroup[] =>
  NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.availableFrom <= phase && !(options.isDemo && MANAGEMENT_ITEMS.includes(item.id)),
    ),
  })).filter((group) => group.items.length > 0);

export const navHref = (siteId: string, item: NavItem): string =>
  item.segment ? `/analytics/${siteId}/${item.segment}` : `/analytics/${siteId}`;
