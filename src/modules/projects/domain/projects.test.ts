import { describe, expect, it } from "vitest";
import {
  dueState,
  formatMinutes,
  parseDuration,
  parseHours,
  parseProjectListQuery,
  parseTaskListQuery,
  progress,
  projectSchema,
  taskSchema,
  todayIn,
} from "./projects";

const project = {
  name: " Website ",
  description: "",
  customer_id: "",
  status: "active",
  visibility: "tenant",
  color: "#6366f1",
  start_date: "2026-12-01",
  due_date: "2026-12-31",
  budget_hours: "12,5",
  lead_member_id: "",
};

describe("Projektformular", () => {
  it("normalisiert Eingaben", () => {
    expect(projectSchema.parse(project)).toEqual({
      name: "Website",
      description: null,
      customer_id: null,
      status: "active",
      visibility: "tenant",
      color: "#6366f1",
      start_date: "2026-12-01",
      due_date: "2026-12-31",
      budget_hours: 12.5,
      lead_member_id: null,
    });
  });

  it("prüft Datum, Reihenfolge und Stunden", () => {
    expect(projectSchema.safeParse({ ...project, due_date: "2026-11-30" }).error?.issues[0]).toMatchObject({
      path: ["due_date"],
      message: "Das Enddatum liegt vor dem Startdatum.",
    });
    expect(projectSchema.safeParse({ ...project, start_date: "2026-02-30" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...project, budget_hours: "zwölf" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...project, color: "red" }).success).toBe(false);
  });
});

describe("Aufgabenformular", () => {
  it("liest Schätzungen in verschiedenen Schreibweisen", () => {
    const base = {
      title: "Entwurf",
      description: "",
      status_id: "6f3c2a52-6d0d-4c0e-8f53-6d0c3d6a8d11",
      priority: "high",
      assignee_member_id: "",
      start_date: "",
      due_date: "",
      milestone_id: "",
    };
    expect(taskSchema.parse({ ...base, estimate_minutes: "1:30" }).estimate_minutes).toBe(90);
    expect(taskSchema.parse({ ...base, estimate_minutes: "2,5" }).estimate_minutes).toBe(150);
    expect(taskSchema.parse({ ...base, estimate_minutes: "45m" }).estimate_minutes).toBe(45);
    expect(taskSchema.parse({ ...base, estimate_minutes: "" }).estimate_minutes).toBeNull();
    expect(taskSchema.safeParse({ ...base, estimate_minutes: "viel" }).success).toBe(false);
  });
});

describe("Hilfsfunktionen", () => {
  it("Stunden und Dauer", () => {
    expect(parseHours("1.000")).toBeNaN();
    expect(parseHours("7,25")).toBe(7.25);
    expect(parseDuration("0:05")).toBe(5);
    expect(parseDuration("1h")).toBe(60);
    expect(formatMinutes(95)).toBe("1:35 h");
    expect(formatMinutes(null)).toBe("–");
  });

  it("Fortschritt und Fälligkeit", () => {
    expect(progress(0, 0)).toBe(0);
    expect(progress(1, 3)).toBe(33);
    expect(dueState("2026-11-26", "2026-11-27", false)).toBe("overdue");
    expect(dueState("2026-11-27", "2026-11-27", false)).toBe("today");
    expect(dueState("2026-11-26", "2026-11-27", true)).toBeNull();
    expect(todayIn("Europe/Berlin", new Date("2026-11-27T23:30:00Z"))).toBe("2026-11-28");
  });

  it("Listenfilter aus der Adresse", () => {
    expect(parseProjectListQuery({})).toEqual({ q: "", status: "open", mine: false, archived: false });
    expect(parseProjectListQuery({ status: "completed", meine: "1" })).toMatchObject({ status: "completed", mine: true });
    expect(parseProjectListQuery({ status: "kaputt" }).status).toBe("open");
    expect(parseTaskListQuery({ zustaendig: "me", erledigt: "1" })).toEqual({ q: "", assignee: "me", done: true });
    expect(parseTaskListQuery({ zustaendig: "drop table" }).assignee).toBe("all");
  });
});

describe("Zeiterfassung", () => {
  const base = { date: "2026-11-27", start: "08:30", end: "", duration: "", note: "", billable: true, task_id: "" };
  it("Ende oder Dauer", async () => {
    const { timeEntrySchema } = await import("./projects");
    expect(timeEntrySchema.parse({ ...base, end: "10:00" })).toMatchObject({ startLocal: "2026-11-27T08:30", minutes: 90 });
    expect(timeEntrySchema.parse({ ...base, duration: "2,5" }).minutes).toBe(150);
    expect(timeEntrySchema.safeParse({ ...base, end: "08:00" }).error?.issues[0].message).toBe("Das Ende muss nach dem Beginn liegen.");
    expect(timeEntrySchema.safeParse(base).error?.issues[0].path).toEqual(["duration"]);
    expect(timeEntrySchema.safeParse({ ...base, duration: "30:00" }).success).toBe(false);
    expect(timeEntrySchema.safeParse({ ...base, start: "25:00", end: "26:00" }).success).toBe(false);
  });

  it("Wochen und Monate", async () => {
    const { weekStart, addDays, parseMonth, monthRange, shiftMonth } = await import("./projects");
    expect(weekStart("2026-11-29")).toBe("2026-11-23");
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(parseMonth("2026-13", "2026-11-27")).toBe("2026-11");
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("Zeitleiste", () => {
  it("Zeitraum und Balken", async () => {
    const { timelineRange, timelineBar } = await import("./projects");
    const items = [
      { id: "a", start: "2026-12-02", end: "2026-12-04" },
      { id: "b", start: null, end: "2026-12-20" },
    ];
    const range = timelineRange(items, "2026-11-27");
    expect(range).toEqual({ from: "2026-11-30", weeks: 4 });
    expect(timelineBar(items[0], range.from, range.weeks)).toEqual({ left: (2 / 28) * 100, width: (3 / 28) * 100 });
    expect(timelineBar({ id: "c", start: null, end: null }, range.from, range.weeks)).toBeNull();
    expect(timelineBar({ id: "d", start: "2027-06-01", end: "2027-06-02" }, range.from, range.weeks)).toBeNull();
  });
});
