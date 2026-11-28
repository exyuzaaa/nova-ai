import "server-only";
import { coreSchema, createSupabaseServerClient, hrSchema } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/modules/crm/domain/crm";
import type { AbsenceStatus, EmploymentType } from "../domain/hr";

/* Lesezugriffe des Personalmoduls. Sichtbarkeit prüft die Datenbank (RLS, SECURITY DEFINER-Funktionen). */

const db = async () => hrSchema(await createSupabaseServerClient());

export type Employee = {
  id: string;
  personnelNumber: string;
  memberId: string | null;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  workPhone: string | null;
  position: string | null;
  departmentId: string | null;
  managerEmployeeId: string | null;
  employmentType: EmploymentType;
  entryDate: string | null;
  exitDate: string | null;
  weeklyHours: number | null;
  workDays: number[];
  vacationDays: number;
};

const COLUMNS =
  "id, personnel_number, member_id, first_name, last_name, work_email, work_phone, position, department_id, manager_employee_id, employment_type, entry_date, exit_date, weekly_hours, work_days, vacation_days";

type Row = {
  id: string;
  personnel_number: string;
  member_id: string | null;
  first_name: string;
  last_name: string;
  work_email: string | null;
  work_phone: string | null;
  position: string | null;
  department_id: string | null;
  manager_employee_id: string | null;
  employment_type: string;
  entry_date: string | null;
  exit_date: string | null;
  weekly_hours: number | null;
  work_days: number[];
  vacation_days: number;
};

const toEmployee = (row: Row): Employee => ({
  id: row.id,
  personnelNumber: row.personnel_number,
  memberId: row.member_id,
  firstName: row.first_name,
  lastName: row.last_name,
  workEmail: row.work_email,
  workPhone: row.work_phone,
  position: row.position,
  departmentId: row.department_id,
  managerEmployeeId: row.manager_employee_id,
  employmentType: row.employment_type as EmploymentType,
  entryDate: row.entry_date,
  exitDate: row.exit_date,
  weeklyHours: row.weekly_hours === null ? null : Number(row.weekly_hours),
  workDays: row.work_days,
  vacationDays: Number(row.vacation_days),
});

export const listEmployees = async (
  tenantId: string,
  filter: { q?: string; departmentId?: string; former?: boolean } = {},
): Promise<Employee[]> => {
  let request = (await db()).from("employees").select(COLUMNS).eq("tenant_id", tenantId);
  const term = sanitizeSearchTerm(filter.q ?? "");
  if (term) request = request.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,position.ilike.%${term}%,personnel_number.ilike.%${term}%`);
  if (filter.departmentId) request = request.eq("department_id", filter.departmentId);
  const today = new Date().toISOString().slice(0, 10);
  request = filter.former ? request.lt("exit_date", today) : request.or(`exit_date.is.null,exit_date.gte.${today}`);
  const { data, error } = await request.order("last_name").order("first_name").limit(1000);
  if (error) throw error;
  return data.map(toEmployee);
};

export const getEmployee = async (tenantId: string, employeeId: string): Promise<Employee | null> => {
  const { data, error } = await (await db()).from("employees").select(COLUMNS).eq("tenant_id", tenantId).eq("id", employeeId).maybeSingle();
  if (error) throw error;
  return data ? toEmployee(data) : null;
};

export type PrivateData = Record<string, string | number | null>;

/** Vertrauliche Daten (nur mit hr.sensitive; sonst null). */
export const getPrivateData = async (tenantId: string, employeeId: string): Promise<PrivateData | null> => {
  const { data } = await (await db()).from("employee_private").select("*").eq("tenant_id", tenantId).eq("employee_id", employeeId).maybeSingle();
  return (data as PrivateData | null) ?? null;
};

export const listDepartments = async (tenantId: string): Promise<{ id: string; name: string }[]> => {
  const { data, error } = await coreSchema(await createSupabaseServerClient()).from("departments").select("id, name").eq("tenant_id", tenantId).order("name");
  if (error) return [];
  return data;
};

export type AbsenceType = { id: string; name: string; color: string; deductsVacation: boolean; requiresApproval: boolean; isSick: boolean; archived: boolean };

export const listAbsenceTypes = async (tenantId: string, includeArchived = false): Promise<AbsenceType[]> => {
  let request = (await db()).from("absence_types").select("id, name, color, deducts_vacation, requires_approval, is_sick, archived_at").eq("tenant_id", tenantId);
  if (!includeArchived) request = request.is("archived_at", null);
  const { data, error } = await request.order("position").order("name");
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    deductsVacation: row.deducts_vacation,
    requiresApproval: row.requires_approval,
    isSick: row.is_sick,
    archived: Boolean(row.archived_at),
  }));
};

export type Absence = {
  id: string;
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  days: number;
  status: AbsenceStatus;
  note: string | null;
  decisionNote: string | null;
  createdAt: string;
};

/** Abwesenheiten mit Details (RLS: eigene, direkte Mitarbeitende, alle mit hr.manage). */
export const listAbsences = async (
  tenantId: string,
  filter: { employeeId?: string; status?: AbsenceStatus; from?: string } = {},
): Promise<Absence[]> => {
  let request = (await db())
    .from("absences")
    .select("id, employee_id, type_id, start_date, end_date, half_day_start, half_day_end, days, status, note, decision_note, created_at")
    .eq("tenant_id", tenantId);
  if (filter.employeeId) request = request.eq("employee_id", filter.employeeId);
  if (filter.status) request = request.eq("status", filter.status);
  if (filter.from) request = request.gte("end_date", filter.from);
  const { data, error } = await request.order("start_date", { ascending: false }).limit(500);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    typeId: row.type_id,
    startDate: row.start_date,
    endDate: row.end_date,
    halfDayStart: row.half_day_start,
    halfDayEnd: row.half_day_end,
    days: Number(row.days),
    status: row.status as AbsenceStatus,
    note: row.note,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
  }));
};

export type Balance = { entitlement: number; adjustments: number; taken: number; planned: number; remaining: number };

export const getVacationBalance = async (employeeId: string, year: number): Promise<Balance | null> => {
  const { data, error } = await (await db()).rpc("vacation_balance", { p_employee: employeeId, p_year: year });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    entitlement: Number(row.entitlement),
    adjustments: Number(row.adjustments),
    taken: Number(row.taken),
    planned: Number(row.planned),
    remaining: Number(row.remaining),
  };
};

export type OverviewEntry = { absenceId: string; employeeId: string; employeeName: string; startDate: string; endDate: string; status: string; label: string; color: string; days: number };

export const getAbsenceOverview = async (tenantId: string, from: string, to: string): Promise<OverviewEntry[]> => {
  const { data, error } = await (await db()).rpc("absence_overview", { p_tenant: tenantId, p_from: from, p_to: to });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    absenceId: row.absence_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    label: row.label,
    color: row.color,
    days: Number(row.days),
  }));
};

export const getMyEmployeeId = async (tenantId: string): Promise<string | null> => {
  const { data } = await (await db()).rpc("my_employee_id", { p_tenant: tenantId });
  return typeof data === "string" ? data : null;
};

export const listAdjustments = async (tenantId: string, employeeId: string, year: number) => {
  const { data } = await (await db())
    .from("vacation_adjustments")
    .select("id, days, reason, created_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .eq("year", year)
    .order("created_at");
  return (data ?? []).map((row) => ({ id: row.id, days: Number(row.days), reason: row.reason }));
};

export const listOnboarding = async (tenantId: string, employeeId: string) => {
  const { data } = await (await db())
    .from("onboarding_tasks")
    .select("id, title, due_date, assignee_member_id, done_at")
    .eq("tenant_id", tenantId)
    .eq("employee_id", employeeId)
    .order("position")
    .order("created_at");
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, dueDate: row.due_date, assigneeMemberId: row.assignee_member_id, done: Boolean(row.done_at) }));
};

export const listHolidays = async (tenantId: string, year: number) => {
  const { data } = await (await db())
    .from("public_holidays")
    .select("date, name")
    .eq("tenant_id", tenantId)
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`)
    .order("date");
  return data ?? [];
};
