/**
 * Grobe Kategorien aus dem User-Agent – nur Familie und Gerätetyp, keine
 * Versionen oder Details, die einen Besucher wiedererkennbar machen würden.
 */
export type DeviceType = "desktop" | "mobile" | "tablet" | "other";
export type UserAgentInfo = { deviceType: DeviceType; browser: string; os: string };

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|okhttp|scrapy|phantomjs|puppeteer|playwright|monitor|uptime|pingdom|statuscake/i;

export const isBot = (userAgent: string): boolean => !userAgent || userAgent.length < 20 || BOT_PATTERN.test(userAgent);

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export const parseUserAgent = (userAgent: string, screenWidth?: number): UserAgentInfo => {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Sonstige";
  const os = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Sonstige";
  let deviceType: DeviceType = "desktop";
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(userAgent)) deviceType = "tablet";
  else if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) deviceType = "mobile";
  // iPadOS meldet sich als Mac – Bildschirmbreite hilft bei der Einordnung
  if (deviceType === "desktop" && os === "macOS" && screenWidth && screenWidth <= 1366 && /Mobile\//.test(userAgent)) {
    deviceType = "tablet";
  }
  if (os === "Sonstige" && browser === "Sonstige") deviceType = "other";
  return { deviceType, browser, os };
};
