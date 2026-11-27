import { describe, expect, it } from "vitest";
import { hasPermission, isModuleKey, isPermission, permissionModule, toPermissionSet } from "./permissions";

describe("Rechtekatalog", () => {
  it("ordnet Rechte ihrem Modul zu", () => {
    expect(permissionModule("analytics.edit")).toBe("analytics");
    expect(permissionModule("core.members.read")).toBe("core");
  });

  it("jedes Recht gehört zu einem bekannten Modul", () => {
    for (const permission of ["core.members.read", "analytics.view", "analytics.manage"]) {
      expect(isModuleKey(permissionModule(permission))).toBe(true);
    }
  });

  it("übernimmt nur bekannte Rechte aus der Datenbank", () => {
    const set = toPermissionSet(["analytics.view", "unbekannt.recht", 42, null]);
    expect([...set]).toEqual(["analytics.view"]);
    expect(hasPermission(set, "analytics.view")).toBe(true);
    expect(hasPermission(set, "analytics.edit")).toBe(false);
  });

  it("erkennt ungültige Werte", () => {
    expect(isPermission("core.billing.manage")).toBe(true);
    expect(isPermission("core.billing")).toBe(false);
    expect(isModuleKey("crm")).toBe(true);
    expect(isModuleKey("CRM")).toBe(false);
  });
});

describe("Übereinstimmung mit der Datenbank", () => {
  it("PERMISSIONS entspricht den Rechten aus den Migrationen", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "supabase", "migrations");
    const keys = new Set<string>();
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, file), "utf8");
      for (const block of sql.matchAll(/insert into core\.permissions[^;]*;/g)) {
        for (const row of block[0].matchAll(/\(\s*'([a-z_]+(?:\.[a-z_]+){1,3})',\s*'([a-z_]+)'/g)) keys.add(row[1]);
      }
    }
    const { PERMISSIONS } = await import("./permissions");
    expect([...keys].sort()).toEqual([...PERMISSIONS].sort());
  });
});
