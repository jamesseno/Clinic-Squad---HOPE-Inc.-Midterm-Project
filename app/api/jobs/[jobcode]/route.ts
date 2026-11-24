import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext { params: Promise<{ jobcode: string }>; }

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { jobcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("edit_job" as BusinessRight)) return fail("You cannot edit jobs.", 403);

  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }
  const body = payload as Record<string, unknown>;
  const jobdesc = typeof body.jobdesc === "string" ? body.jobdesc.trim() : "";
  if (!jobdesc || jobdesc.length > 20) return fail("Job description must be 1-20 characters.", 400);

  const { data, error } = await context.session
    .from("job")
    .update({ jobdesc })
    .eq("jobcode", jobcode.toUpperCase())
    .eq("is_deleted", false)
    .select("jobcode, jobdesc, is_deleted, stamp")
    .maybeSingle();

  if (error) { const m = mapBusinessDatabaseError(error, "job update"); return fail(m.error, m.status); }
  if (!data) return fail("Job not found.", 404);
  return NextResponse.json({ job: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { jobcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_job" as BusinessRight)) return fail("You cannot delete jobs.", 403);

  const code = jobcode.toUpperCase();
  const { data: current } = await context.admin.from("job").select("jobcode, is_deleted").eq("jobcode", code).maybeSingle();
  if (!current) return fail("Job not found.", 404);
  if (current.is_deleted) return fail("Job is already deleted.", 409);

  const { error } = await context.session.from("job").update({ is_deleted: true }).eq("jobcode", code);
  if (error) { const m = mapBusinessDatabaseError(error, "job delete"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("job").select("jobcode, is_deleted, stamp").eq("jobcode", code).maybeSingle();
  if (!updated || !updated.is_deleted) return fail("Delete could not be verified.", 500);
  return NextResponse.json({ job: updated }, { headers: noStore });
}

export async function POST(_request: Request, route: RouteContext) {
  const { jobcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_job" as BusinessRight)) return fail("You cannot restore jobs.", 403);

  const code = jobcode.toUpperCase();
  const { data: current } = await context.admin.from("job").select("jobcode, is_deleted").eq("jobcode", code).maybeSingle();
  if (!current) return fail("Job not found.", 404);
  if (!current.is_deleted) return fail("Job is already active.", 409);

  const { error } = await context.session.from("job").update({ is_deleted: false }).eq("jobcode", code);
  if (error) { const m = mapBusinessDatabaseError(error, "job restore"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("job").select("jobcode, is_deleted, stamp").eq("jobcode", code).maybeSingle();
  if (!updated || updated.is_deleted) return fail("Restore could not be verified.", 500);
  return NextResponse.json({ job: updated }, { headers: noStore });
}
