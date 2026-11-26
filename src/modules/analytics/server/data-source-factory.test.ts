import { afterEach, describe, expect, it, vi } from "vitest";
import { getDataSource } from "./data-source-factory";
import { DEMO_SITE, getSite, isDemoEnabled, type Site } from "./sites";

const REAL_SITE: Site = { ...DEMO_SITE, id: "real", name: "Echte GmbH", isDemo: false };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDemoEnabled", () => {
  it("ist in Produktion ohne ausdrückliche Freigabe aus", () => {
    expect(isDemoEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDemoEnabled({ NODE_ENV: "production", ANALYTICS_DEMO_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("ist in der Entwicklung an, kann aber abgeschaltet werden", () => {
    expect(isDemoEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isDemoEnabled({ NODE_ENV: "development", ANALYTICS_DEMO_ENABLED: "false" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("getDataSource", () => {
  const fakeClient = async () => ({ dailyStats: async () => [], breakdown: async () => [], distribution: async () => [] });

  it("gibt echten Websites niemals Demo-Daten", async () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "true");
    expect((await getDataSource(REAL_SITE, fakeClient)).kind).toBe("live");
  });

  it("liefert für die Demo-Website die Demo-Quelle", async () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "true");
    expect((await getDataSource(DEMO_SITE, fakeClient)).kind).toBe("demo");
  });

  it("verweigert Demo-Daten, wenn sie abgeschaltet sind", async () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "false");
    await expect(getDataSource(DEMO_SITE, fakeClient)).rejects.toThrow(/deaktiviert/);
  });
});

describe("getSite", () => {
  it("findet die Demo-Website nur, wenn Demo-Daten erlaubt sind", async () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "true");
    expect((await getSite("demo"))?.isDemo).toBe(true);
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "false");
    expect(await getSite("demo")).toBeNull();
    expect(await getSite("unbekannt")).toBeNull();
  });
});
