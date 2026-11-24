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

export async function PATCH(request: Request, route: RouteContext) {
  const { empno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("edit_employee" as BusinessRight)) return fail("You cannot edit employees.", 403);

  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }
  const body = payload as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof body.lastname === "string") updates.lastname = body.lastname.trim();
  if (typeof body.firstname === "string") updates.firstname = body.firstname.trim();
  if (typeof body.gender === "string") updates.gender = body.gender.trim().toUpperCase();
  if (typeof body.birthdate === "string") updates.birthdate = body.birthdate.trim() || null;
  if (typeof body.hiredate === "string") updates.hiredate = body.hiredate.trim() || null;
  if (typeof body.sepdate === "string") updates.sepdate = body.sepdate.trim() || null;

  if (Object.keys(updates).length === 0) return fail("No fields to update.", 400);

  const { data, error } = await context.session
    .from("employee")
    .update(updates)
    .eq("empno", empno.toUpperCase())
    .eq("is_deleted", false)
    .select("empno, lastname, firstname, gender, birthdate, hiredate, sepdate, is_deleted, stamp")
    .maybeSingle();

  if (error) { const m = mapBusinessDatabaseError(error, "employee update"); return fail(m.error, m.status); }
  if (!data) return fail("Employee not found.", 404);
  return NextResponse.json({ employee: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { empno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_employee" as BusinessRight)) return fail("You cannot delete employees.", 403);

  const code = empno.toUpperCase();
  const { data: current } = await context.admin.from("employee").select("empno, is_deleted").eq("empno", code).maybeSingle();
  if (!current) return fail("Employee not found.", 404);
  if (current.is_deleted) return fail("Employee is already deleted.", 409);

  const { error } = await context.session.from("employee").update({ is_deleted: true }).eq("empno", code);
  if (error) { const m = mapBusinessDatabaseError(error, "employee delete"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("employee").select("empno, is_deleted, stamp").eq("empno", code).maybeSingle();
  if (!updated || !updated.is_deleted) return fail("Delete could not be verified.", 500);
  return NextResponse.json({ employee: updated }, { headers: noStore });
}

export async function POST(_request: Request, route: RouteContext) {
  const { empno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_employee" as BusinessRight)) return fail("You cannot restore employees.", 403);

  const code = empno.toUpperCase();
  const { data: current } = await context.admin.from("employee").select("empno, is_deleted").eq("empno", code).maybeSingle();
  if (!current) return fail("Employee not found.", 404);
  if (!current.is_deleted) return fail("Employee is already active.", 409);

  const { error } = await context.session.from("employee").update({ is_deleted: false }).eq("empno", code);
  if (error) { const m = mapBusinessDatabaseError(error, "employee restore"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("employee").select("empno, is_deleted, stamp").eq("empno", code).maybeSingle();
  if (!updated || updated.is_deleted) return fail("Restore could not be verified.", 500);
  return NextResponse.json({ employee: updated }, { headers: noStore });
}
