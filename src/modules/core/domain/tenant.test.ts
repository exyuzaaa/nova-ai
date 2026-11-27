import { describe, expect, it } from "vitest";
import { assignableRoles, hasRole, invitableRoles } from "./roles";
import { invitationSchema, isInvitationToken, slugify } from "./tenant-validation";

describe("slugify", () => {
  it("bildet deutsche Umlaute ab", () => {
    expect(slugify("Müller & Söhne GmbH")).toBe("mueller-soehne-gmbh");
    expect(slugify("Straße 1")).toBe("strasse-1");
  });

  it("erfüllt die Datenbankregel für Kürzel", () => {
    for (const name of ["A", "!!!", "Sehr langer Name ".repeat(10), "Ärger"]) {
      expect(slugify(name)).toMatch(/^[a-z0-9][a-z0-9-]{1,62}$/);
    }
  });
});

describe("Einladungen", () => {
  it("erlaubt keine Owner-Einladung", () => {
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "owner" }).success).toBe(false);
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "admin" }).success).toBe(true);
    expect(invitationSchema.safeParse({ email: "a@b.de", role: "superuser" }).success).toBe(false);
  });

  it("erkennt nur gültige Tokens", () => {
    expect(isInvitationToken("a".repeat(48))).toBe(true);
    expect(isInvitationToken("A".repeat(48))).toBe(false);
    expect(isInvitationToken("../x")).toBe(false);
  });
});

describe("Rollen", () => {
  it("bildet die Hierarchie ab", () => {
    expect(hasRole("owner", "admin")).toBe(true);
    expect(hasRole("member", "admin")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
  });

  it("lässt Owner-Rechte nur durch Owner vergeben", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).not.toContain("owner");
    expect(assignableRoles("member")).toEqual([]);
    expect(invitableRoles("owner")).not.toContain("owner");
  });
});
