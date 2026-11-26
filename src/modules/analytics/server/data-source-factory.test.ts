import { afterEach, describe, expect, it, vi } from "vitest";
import { getDataSource, LiveDataSourceUnavailableError } from "./data-source-factory";
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
  it("gibt echten Websites niemals Demo-Daten", () => {
    expect(() => getDataSource(REAL_SITE)).toThrow(LiveDataSourceUnavailableError);
  });

  it("liefert für die Demo-Website die Demo-Quelle", () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "true");
    expect(getDataSource(DEMO_SITE).kind).toBe("demo");
  });

  it("verweigert Demo-Daten, wenn sie abgeschaltet sind", () => {
    vi.stubEnv("ANALYTICS_DEMO_ENABLED", "false");
    expect(() => getDataSource(DEMO_SITE)).toThrow(/deaktiviert/);
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
