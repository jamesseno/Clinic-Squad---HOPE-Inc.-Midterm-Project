import { NextResponse } from "next/server";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import type { BusinessRight } from "@/lib/business-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!["view_job", "add_job", "edit_job", "delete_job"].some((r) => context.access.rights.has(r as BusinessRight)))
    return fail("You do not have Job access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !context.access.rights.has("delete_job" as BusinessRight))
    return fail("You need the delete-job right to view deleted jobs.", 403);

  const { data, error } = await context.admin
    .from("job")
    .select("jobcode, jobdesc, is_deleted, stamp")
    .order("jobcode", { ascending: true })
    .limit(200);

  if (error) { const m = mapBusinessDatabaseError(error, "job list"); return fail(m.error, m.status); }

  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const jobs = (data ?? []).filter((row) => {
    if (!includeDeleted && row.is_deleted) return false;
    if (!query) return true;
    return [row.jobcode, row.jobdesc].some((v) => v?.toLowerCase().includes(query));
  });

  return NextResponse.json(
    {
      jobs,
      permissions: {
        add: context.access.rights.has("add_job" as BusinessRight),
        edit: context.access.rights.has("edit_job" as BusinessRight),
        delete: context.access.rights.has("delete_job" as BusinessRight),
        canViewDeleted: context.access.rights.has("delete_job" as BusinessRight),
        canRestore: context.access.rights.has("delete_job" as BusinessRight) && includeDeleted,
      },
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("add_job" as BusinessRight)) return fail("You cannot add jobs.", 403);

  const body = payload as Record<string, unknown>;
  const jobcode = typeof body.jobcode === "string" ? body.jobcode.trim().toUpperCase() : "";
  const jobdesc = typeof body.jobdesc === "string" ? body.jobdesc.trim() : "";
  if (!jobcode || jobcode.length > 4) return fail("Job code must be 1-4 characters.", 400);
  if (!jobdesc || jobdesc.length > 20) return fail("Job description must be 1-20 characters.", 400);

  const { data, error } = await context.session
    .from("job")
    .insert({ jobcode, jobdesc })
    .select("jobcode, jobdesc, is_deleted, stamp")
    .single();

  if (error) { const m = mapBusinessDatabaseError(error, "job creation"); return fail(m.error, m.status); }
  return NextResponse.json({ job: data }, { status: 201, headers: noStore });
}
