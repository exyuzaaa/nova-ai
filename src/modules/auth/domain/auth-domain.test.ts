import { describe, expect, it } from "vitest";
import { isGuestOnlyPath, isProtectedPath, safeNextPath } from "./redirects";
import { authErrorMessage, loginSchema, newPasswordSchema, signUpSchema } from "./validation";

describe("safeNextPath (Schutz vor offenen Weiterleitungen)", () => {
  it("erlaubt relative Pfade innerhalb der App", () => {
    expect(safeNextPath("/einladung/abc")).toBe("/einladung/abc");
    expect(safeNextPath("/analytics/x?range=7d")).toBe("/analytics/x?range=7d");
  });

  it.each([
    "https://boese.example",
    "//boese.example/pfad",
    "/\\boese.example",
    "javascript:alert(1)",
    "analytics",
    "/\u0000x",
    "",
    undefined,
    42,
  ])("weist %s ab", (value) => {
    expect(safeNextPath(value)).toBe("/analytics");
  });

  it("nutzt den angegebenen Rückfallwert", () => {
    expect(safeNextPath("https://x.example", "/onboarding")).toBe("/onboarding");
  });
});

describe("Geschützte Bereiche", () => {
  it("schützt Analytics, Einrichtung und Passwortänderung", () => {
    expect(isProtectedPath("/analytics")).toBe(true);
    expect(isProtectedPath("/analytics/demo/settings")).toBe(true);
    expect(isProtectedPath("/onboarding")).toBe(true);
    expect(isProtectedPath("/passwort-neu")).toBe(true);
  });

  it("lässt öffentliche Seiten frei", () => {
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/einladung/abc")).toBe(false);
    expect(isProtectedPath("/analyticsx")).toBe(false);
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/passwort-neu")).toBe(false);
  });
});

describe("Formularvalidierung", () => {
  it("normalisiert E-Mail-Adressen", () => {
    const result = loginSchema.safeParse({ email: "  Max@Beispiel.DE ", password: "x" });
    expect(result.success && result.data.email).toBe("max@beispiel.de");
  });

  it("verlangt sichere Passwörter bei der Registrierung", () => {
    expect(signUpSchema.safeParse({ email: "a@b.de", password: "kurz1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.de", password: "nurbuchstaben" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.de", password: "1234567890" }).success).toBe(false);
    expect(signUpSchema.safeParse({ email: "a@b.de", password: "Sicher-2026x" }).success).toBe(true);
  });

  it("prüft die Passwortwiederholung", () => {
    const result = newPasswordSchema.safeParse({ password: "Sicher-2026x", passwordConfirm: "Sicher-2026y" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["passwordConfirm"]);
  });

  it("übersetzt Auth-Fehler ohne technische Details", () => {
    expect(authErrorMessage("invalid_credentials")).toContain("falsch");
    expect(authErrorMessage("irgendwas")).toBe("Das hat nicht geklappt. Bitte versuche es erneut.");
  });
});
