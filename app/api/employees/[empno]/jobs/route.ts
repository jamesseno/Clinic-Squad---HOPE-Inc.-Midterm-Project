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

  const canViewSalary = context.access.rights.has("view_job_history" as BusinessRight);
  const jobs = (data ?? []).map((j: { empno: string; jobcode: string; effdate: string; salary: number; deptcode: string | null; is_deleted: boolean }) => ({
    ...j,
    salary: canViewSalary ? j.salary : null,
  }));

  return NextResponse.json({ jobs, permissions: {
    add: context.access.rights.has("add_job_history" as BusinessRight),
    edit: context.access.rights.has("edit_job_history" as BusinessRight),
    delete: context.access.rights.has("delete_job_history" as BusinessRight),
    canViewSalary,
  }}, { headers: noStore });
}

export async function POST(request: Request, route: RouteContext) {
  const { empno } = await route.params;
  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("add_job_history" as BusinessRight)) return fail("You cannot add job history.", 403);

  const body = payload as Record<string, unknown>;
  const jobcode = typeof body.jobcode === "string" ? body.jobcode.trim().toUpperCase() : "";
  const effdate = typeof body.effdate === "string" ? body.effdate.trim() : "";
  const salary = typeof body.salary === "number" ? body.salary : Number(body.salary);
  const deptcode = typeof body.deptcode === "string" ? body.deptcode.trim().toUpperCase() : null;

  if (!jobcode) return fail("Job code is required.", 400);
  if (!effdate) return fail("Effective date is required.", 400);
  if (!Number.isFinite(salary) || salary < 0) return fail("Salary must be 0 or greater.", 400);

  const { data, error } = await context.session
    .from("jobhistory")
    .insert({ empno: empno.toUpperCase(), jobcode, effdate, salary, deptcode })
    .select("empno, jobcode, effdate, salary, deptcode, is_deleted, stamp")
    .single();

  if (error) { const m = mapBusinessDatabaseError(error, "job history creation"); return fail(m.error, m.status); }
  return NextResponse.json({ jobHistory: data }, { status: 201, headers: noStore });
}
