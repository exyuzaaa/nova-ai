import { describe, expect, it } from "vitest";
import { localDateTimeToUtc, utcToLocalDateTime } from "./time-zone";

describe("Zeitzonen", () => {
  it("rechnet Winter- und Sommerzeit in Berlin richtig um", () => {
    expect(localDateTimeToUtc("2026-12-01T10:00", "Europe/Berlin")).toBe("2026-12-01T09:00:00.000Z");
    expect(localDateTimeToUtc("2026-07-01T10:00", "Europe/Berlin")).toBe("2026-07-01T08:00:00.000Z");
    expect(localDateTimeToUtc("2026-07-01T10:00", "UTC")).toBe("2026-07-01T10:00:00.000Z");
  });

  it("ist umkehrbar", () => {
    for (const local of ["2026-03-29T12:00", "2026-10-25T18:30", "2027-01-15T00:05"]) {
      const utc = localDateTimeToUtc(local, "Europe/Berlin");
      expect(utc && utcToLocalDateTime(utc, "Europe/Berlin")).toBe(local);
    }
  });

  it("lehnt ungültige Eingaben ab", () => {
    expect(localDateTimeToUtc("morgen", "Europe/Berlin")).toBeNull();
    expect(utcToLocalDateTime("kaputt", "Europe/Berlin")).toBe("");
  });
});
