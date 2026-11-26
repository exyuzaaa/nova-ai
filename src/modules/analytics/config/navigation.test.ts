import { describe, expect, it } from "vitest";
import { ALL_NAV_ITEMS, navHref, visibleNavigation } from "./navigation";

describe("Navigation", () => {
  it("enthält alle 17 Bereiche des Briefings genau einmal", () => {
    expect(ALL_NAV_ITEMS).toHaveLength(17);
    expect(new Set(ALL_NAV_ITEMS.map((item) => item.id)).size).toBe(17);
    expect(new Set(ALL_NAV_ITEMS.map((item) => item.segment)).size).toBe(17);
  });

  it("zeigt nur Bereiche mit echter Funktion", () => {
    expect(visibleNavigation(2).flatMap((group) => group.items).map((item) => item.id)).toEqual(["dashboard"]);
    expect(visibleNavigation(3).flatMap((group) => group.items).map((item) => item.id)).toEqual(["dashboard", "settings"]);
  });

  it("blendet Verwaltung für die Demo-Website aus", () => {
    const visible = visibleNavigation(3, { isDemo: true }).flatMap((group) => group.items);
    expect(visible.map((item) => item.id)).toEqual(["dashboard"]);
  });

  it("blendet Bereiche mit ihrer Phase ein", () => {
    expect(visibleNavigation(13).flatMap((group) => group.items)).toHaveLength(17);
  });

  it("baut Links unterhalb der Website", () => {
    expect(navHref("demo", ALL_NAV_ITEMS[0])).toBe("/analytics/demo");
    expect(navHref("demo", ALL_NAV_ITEMS[1])).toBe("/analytics/demo/realtime");
  });
});
