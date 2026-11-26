import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext { params: Promise<{ empno: string }>; }

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function GET(_request: Request, route: RouteContext) {
  const { empno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("view_job_history" as BusinessRight)) return fail("You do not have Job History access.", 403);

  const { data, error } = await context.admin
    .from("jobhistory")
    .select("empno, jobcode, effdate, salary, deptcode, is_deleted, stamp")
    .eq("empno", empno.toUpperCase())
    .order("effdate", { ascending: false });

  if (error) { const m = mapBusinessDatabaseError(error, "job history list"); return fail(m.error, m.status); }

  const jobs = (data ?? []).map((j: { empno: string; jobcode: string; effdate: string; salary: number; deptcode: string | null; is_deleted: boolean }) => ({
    ...j,
  }));

  return NextResponse.json({ jobs, permissions: {
    add: context.access.rights.has("add_job_history" as BusinessRight),
    edit: context.access.rights.has("edit_job_history" as BusinessRight),
    delete: context.access.rights.has("delete_job_history" as BusinessRight),
    canViewSalary: true,
  }}, { headers: noStore });
}

export async function POST(request: Request, route: RouteContext) {
  const { empno } = await route.params;
  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("add_job_history" as BusinessRight)) return fail("You cannot add job history.", 403);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fail("Request body must be a JSON object.", 400);
  const body = payload as Record<string, unknown>;
  const jobcode = typeof body.jobcode === "string" ? body.jobcode.trim().toUpperCase() : "";
  const effdate = typeof body.effdate === "string" ? body.effdate.trim() : "";
  const salary = typeof body.salary === "number" ? body.salary : typeof body.salary === "string" && body.salary.trim() ? Number(body.salary) : Number.NaN;
  const deptcode = typeof body.deptcode === "string" ? body.deptcode.trim().toUpperCase() || null : body.deptcode === null || body.deptcode === undefined ? null : "";

  if (!jobcode || jobcode.length > 4) return fail("Job code must be 1-4 characters.", 400);
  if (!validDate(effdate)) return fail("Effective date must be a valid calendar date in YYYY-MM-DD format.", 400);
  if (!Number.isFinite(salary) || salary < 0 || salary > 99999999.99) return fail("Salary must be between 0 and 99,999,999.99.", 400);
  if (deptcode === "" || (deptcode && deptcode.length > 3)) return fail("Department code must be 1-3 characters.", 400);

  const employeeCode = empno.trim().toUpperCase();
  if (!employeeCode || employeeCode.length > 5) return fail("Employee number is invalid.", 400);
  const { data: employee, error: employeeError } = await context.admin
    .from("employee")
    .select("empno, is_deleted")
    .eq("empno", employeeCode)
    .maybeSingle();
  if (employeeError) { const m = mapBusinessDatabaseError(employeeError, "employee lookup"); return fail(m.error, m.status); }
  if (!employee || employee.is_deleted) return fail("Active employee not found.", 404);

  const { data, error } = await context.session
    .from("jobhistory")
    .insert({ empno: employeeCode, jobcode, effdate, salary, deptcode })
    .select("empno, jobcode, effdate, salary, deptcode, is_deleted, stamp")
    .single();

  if (error) { const m = mapBusinessDatabaseError(error, "job history creation"); return fail(m.error, m.status); }
  const jobHistory = context.access.rights.has("view_job_history" as BusinessRight) ? data : { ...data, salary: null };
  return NextResponse.json({ jobHistory }, { status: 201, headers: noStore });
}
