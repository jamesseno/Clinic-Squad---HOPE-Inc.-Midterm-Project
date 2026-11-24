import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext { params: Promise<{ deptcode: string }>; }

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { deptcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("edit_department" as BusinessRight)) return fail("You cannot edit departments.", 403);

  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }
  const body = payload as Record<string, unknown>;
  const deptname = typeof body.deptname === "string" ? body.deptname.trim() : "";
  if (!deptname || deptname.length > 20) return fail("Department name must be 1-20 characters.", 400);

  const { data, error } = await context.session
    .from("department")
    .update({ deptname })
    .eq("deptcode", deptcode.toUpperCase())
    .eq("is_deleted", false)
    .select("deptcode, deptname, is_deleted, stamp")
    .maybeSingle();

  if (error) { const m = mapBusinessDatabaseError(error, "department update"); return fail(m.error, m.status); }
  if (!data) return fail("Department not found.", 404);
  return NextResponse.json({ department: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { deptcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_department" as BusinessRight)) return fail("You cannot delete departments.", 403);

  const code = deptcode.toUpperCase();
  const { data: current } = await context.admin.from("department").select("deptcode, is_deleted").eq("deptcode", code).maybeSingle();
  if (!current) return fail("Department not found.", 404);
  if (current.is_deleted) return fail("Department is already deleted.", 409);

  const { error } = await context.session.from("department").update({ is_deleted: true }).eq("deptcode", code);
  if (error) { const m = mapBusinessDatabaseError(error, "department delete"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("department").select("deptcode, is_deleted, stamp").eq("deptcode", code).maybeSingle();
  if (!updated || !updated.is_deleted) return fail("Delete could not be verified.", 500);
  return NextResponse.json({ department: updated }, { headers: noStore });
}

export async function POST(_request: Request, route: RouteContext) {
  const { deptcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_department" as BusinessRight)) return fail("You cannot restore departments.", 403);

  const code = deptcode.toUpperCase();
  const { data: current } = await context.admin.from("department").select("deptcode, is_deleted").eq("deptcode", code).maybeSingle();
  if (!current) return fail("Department not found.", 404);
  if (!current.is_deleted) return fail("Department is already active.", 409);

  const { error } = await context.session.from("department").update({ is_deleted: false }).eq("deptcode", code);
  if (error) { const m = mapBusinessDatabaseError(error, "department restore"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("department").select("deptcode, is_deleted, stamp").eq("deptcode", code).maybeSingle();
  if (!updated || updated.is_deleted) return fail("Restore could not be verified.", 500);
  return NextResponse.json({ department: updated }, { headers: noStore });
}
