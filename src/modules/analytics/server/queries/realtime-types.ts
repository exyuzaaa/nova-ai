/** Momentaufnahme der Echtzeit-Ansicht (Server → Client). Reine Typen. */
export type RealtimeItem = { key: string; visitors: number };
export type RealtimeEvent = { type: string; name: string; path: string; at: string };

export type RealtimeSnapshot = {
  generatedAt: string;
  activeNow: number;
  active30m: number;
  sessions30m: number;
  pageviews30m: number;
  events30m: number;
  /** 30 Werte, ältester zuerst, letzter = aktuelle Minute. */
  pageviewsPerMinute: number[];
  pages: RealtimeItem[];
  channels: RealtimeItem[];
  countries: RealtimeItem[];
  devices: RealtimeItem[];
  recentEvents: RealtimeEvent[];
};
