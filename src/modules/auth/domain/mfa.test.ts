import { describe, expect, it } from "vitest";
import { factorNameSchema, mfaErrorMessage, needsSecondFactor, totpCodeSchema } from "./mfa";

describe("Zwei-Faktor-Anmeldung", () => {
  it("akzeptiert sechsstellige Codes, auch mit Leerzeichen", () => {
    expect(totpCodeSchema.safeParse("123 456").success && totpCodeSchema.parse("123 456")).toBe("123456");
    for (const code of ["12345", "1234567", "abcdef", ""]) expect(totpCodeSchema.safeParse(code).success).toBe(false);
  });

  it("verlangt den zweiten Faktor nur, wenn er eingerichtet und noch nicht bestätigt ist", () => {
    expect(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(needsSecondFactor({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(needsSecondFactor({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(needsSecondFactor(null)).toBe(false);
  });

  it("vergibt einen Standardnamen und übersetzt Fehler", () => {
    expect(factorNameSchema.parse("  ")).toBe("Authenticator-App");
    expect(mfaErrorMessage("mfa_verification_failed")).toContain("Code ist falsch");
    expect(mfaErrorMessage("unbekannt")).toContain("nicht geklappt");
  });
});
