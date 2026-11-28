import { describe, expect, it } from "vitest";
import { buildIcs, describeRepeat, escapeIcsText, eventSchema, foldIcsLine, parseView, shiftView, viewRange, weekStart } from "./calendar";

const base = {
  calendar_id: "6f3c2a52-6d0d-4c0e-8f53-6d0c3d6a8d11",
  title: " Teamrunde ",
  description: "",
  location: "",
  all_day: false,
  start_date: "2027-03-01",
  start_time: "09:00",
  end_date: "2027-03-01",
  end_time: "10:30",
  repeat: "none",
  repeat_interval: "1",
  repeat_weekdays: [],
  repeat_end: "never",
  repeat_until: "",
  repeat_count: "",
  reminder_minutes: "15",
  attendees: [],
};

describe("Terminformular", () => {
  it("normalisiert einen einfachen Termin", () => {
    expect(eventSchema.parse(base)).toMatchObject({
      title: "Teamrunde",
      startLocal: "2027-03-01T09:00",
      endLocal: "2027-03-01T10:30",
      repeat_freq: null,
      reminder_minutes: 15,
      location: null,
    });
  });

  it("ganztägig: Ende ist der Folgetag", () => {
    expect(eventSchema.parse({ ...base, all_day: true, end_date: "2027-03-03", start_time: "", end_time: "" })).toMatchObject({
      startLocal: "2027-03-01T00:00",
      endLocal: "2027-03-04T00:00",
    });
  });

  it("prüft Reihenfolge, Länge und Serienende", () => {
    expect(eventSchema.safeParse({ ...base, end_time: "08:00" }).error?.issues[0]).toMatchObject({ path: ["end_time"] });
    expect(eventSchema.safeParse({ ...base, end_date: "2027-05-01" }).error?.issues[0].message).toBe("Ein Termin darf höchstens 31 Tage dauern.");
    expect(eventSchema.safeParse({ ...base, repeat: "weekly", repeat_end: "until", repeat_until: "2027-02-01" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, repeat: "weekly", repeat_end: "count", repeat_count: "0" }).success).toBe(false);
  });

  it("Wiederholung wöchentlich mit Wochentagen", () => {
    const parsed = eventSchema.parse({ ...base, repeat: "weekly", repeat_interval: "2", repeat_weekdays: ["3", "1", "3"], repeat_end: "count", repeat_count: "6" });
    expect(parsed).toMatchObject({ repeat_freq: "weekly", repeat_interval: 2, repeat_weekdays: [1, 3], repeat_count: 6 });
    expect(
      describeRepeat({ repeatFreq: "weekly", repeatInterval: 2, repeatWeekdays: [1, 3], repeatUntil: null, repeatCount: 6 }),
    ).toBe("Alle 2 Wochen am Mo, Mi · 6-mal");
    expect(describeRepeat({ repeatFreq: "monthly", repeatInterval: 1, repeatWeekdays: [], repeatUntil: "2027-12-31", repeatCount: null })).toBe(
      "Monatlich · bis 31.12.2027",
    );
  });
});

describe("Ansichten", () => {
  it("Monat beginnt am Montag vor dem 1. und endet nach dem letzten Sonntag", () => {
    expect(viewRange("monat", "2027-03-15")).toEqual({ from: "2027-03-01", to: "2027-04-05" });
    expect(viewRange("monat", "2026-11-27")).toEqual({ from: "2026-10-26", to: "2026-12-07" });
    expect(viewRange("woche", "2026-11-29")).toEqual({ from: "2026-11-23", to: "2026-11-30" });
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });

  it("blättern und Parameter", () => {
    expect(shiftView("monat", "2027-01-31", -1)).toBe("2026-12-01");
    expect(shiftView("woche", "2027-01-31", 1)).toBe("2027-02-07");
    expect(parseView({ ansicht: "woche", datum: "2027-02-30" }, "2026-11-27")).toEqual({ view: "woche", date: "2026-11-27" });
    expect(parseView({}, "2026-11-27").view).toBe("monat");
  });
});

describe("iCal", () => {
  it("maskiert Text und faltet lange Zeilen", () => {
    expect(escapeIcsText("A; B, C\nD\\")).toBe("A\\; B\\, C\\nD\\\\");
    const folded = foldIcsLine(`SUMMARY:${"ä".repeat(60)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n ").join("")).toBe(`SUMMARY:${"ä".repeat(60)}`);
  });

  it("erzeugt Termine mit Wiederholung und Ausnahmen", () => {
    const ics = buildIcs("NOVA", [
      {
        id: "e1",
        title: "Jour fixe",
        description: null,
        location: "Raum 1",
        startsAt: "2027-03-22T09:00:00Z",
        endsAt: "2027-03-22T09:30:00Z",
        allDay: false,
        repeatFreq: "weekly",
        repeatInterval: 1,
        repeatWeekdays: [1, 3],
        repeatUntil: null,
        repeatCount: 5,
        exceptions: ["2027-03-29T08:00:00Z"],
        updatedAt: "2026-11-27T10:00:00Z",
      },
      {
        id: "e2",
        title: "Urlaub",
        description: null,
        location: null,
        startsAt: "2027-07-31T22:00:00Z",
        endsAt: "2027-08-14T22:00:00Z",
        allDay: true,
        startDate: "2027-08-01",
        endDate: "2027-08-15",
        repeatFreq: null,
        repeatInterval: 1,
        repeatWeekdays: [],
        repeatUntil: null,
        repeatCount: null,
        exceptions: [],
        updatedAt: "2026-11-27T10:00:00Z",
      },
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20270322T090000Z\r\n");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5\r\n");
    expect(ics).toContain("EXDATE:20270329T080000Z\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270801\r\nDTEND;VALUE=DATE:20270815\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
