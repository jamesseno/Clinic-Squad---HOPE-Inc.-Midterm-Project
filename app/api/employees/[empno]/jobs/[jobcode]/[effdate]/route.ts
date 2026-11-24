import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext { params: Promise<{ empno: string; jobcode: string; effdate: string }>; }

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { empno, jobcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("edit_job_history" as BusinessRight)) return fail("You cannot edit job history.", 403);

  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }
  const body = payload as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof body.salary === "number") updates.salary = body.salary;
  if (typeof body.deptcode === "string") updates.deptcode = body.deptcode.trim().toUpperCase() || null;
  if (typeof body.jobcode === "string") updates.jobcode = body.jobcode.trim().toUpperCase();

  if (Object.keys(updates).length === 0) return fail("No fields to update.", 400);

  const { data, error } = await context.session
    .from("jobhistory")
    .update(updates)
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate)
    .eq("is_deleted", false)
    .select("empno, jobcode, effdate, salary, deptcode, is_deleted, stamp")
    .maybeSingle();

  if (error) { const m = mapBusinessDatabaseError(error, "job history update"); return fail(m.error, m.status); }
  if (!data) return fail("Job history entry not found.", 404);
  return NextResponse.json({ jobHistory: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { empno, jobcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_job_history" as BusinessRight)) return fail("You cannot delete job history.", 403);

  const { data: current } = await context.admin
    .from("jobhistory")
    .select("empno, jobcode, effdate, is_deleted")
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate)
    .maybeSingle();

  if (!current) return fail("Job history entry not found.", 404);
  if (current.is_deleted) return fail("Entry is already deleted.", 409);

  const { error } = await context.session
    .from("jobhistory")
    .update({ is_deleted: true })
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate);

  if (error) { const m = mapBusinessDatabaseError(error, "job history delete"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin
    .from("jobhistory")
    .select("empno, jobcode, effdate, is_deleted, stamp")
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate)
    .maybeSingle();

  if (!updated || !updated.is_deleted) return fail("Delete could not be verified.", 500);
  return NextResponse.json({ jobHistory: updated }, { headers: noStore });
}

export async function POST(_request: Request, route: RouteContext) {
  const { empno, jobcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_job_history" as BusinessRight)) return fail("You cannot restore job history.", 403);

  const { data: current } = await context.admin
    .from("jobhistory")
    .select("empno, jobcode, effdate, is_deleted")
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate)
    .maybeSingle();

  if (!current) return fail("Job history entry not found.", 404);
  if (!current.is_deleted) return fail("Entry is already active.", 409);

  const { error } = await context.session
    .from("jobhistory")
    .update({ is_deleted: false })
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate);

  if (error) { const m = mapBusinessDatabaseError(error, "job history restore"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin
    .from("jobhistory")
    .select("empno, jobcode, effdate, is_deleted, stamp")
    .eq("empno", empno.toUpperCase())
    .eq("jobcode", jobcode.toUpperCase())
    .eq("effdate", effdate)
    .maybeSingle();

  if (!updated || updated.is_deleted) return fail("Restore could not be verified.", 500);
  return NextResponse.json({ jobHistory: updated }, { headers: noStore });
}
