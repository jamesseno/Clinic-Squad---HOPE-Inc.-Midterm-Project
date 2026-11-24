import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { hasAnyBusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const deptRights = ["view_department", "add_department", "edit_department", "delete_department"] as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!["view_department", "add_department", "edit_department", "delete_department"].some((r) => context.access.rights.has(r as BusinessRight)))
    return fail("You do not have Department access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !context.access.rights.has("delete_department" as BusinessRight))
    return fail("You need the delete-department right to view deleted departments.", 403);

  const { data, error } = await context.admin
    .from("department")
    .select("deptcode, deptname, is_deleted, stamp")
    .order("deptcode", { ascending: true })
    .limit(200);

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "department list");
    return fail(mapped.error, mapped.status);
  }

  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const departments = (data ?? []).filter((row) => {
    if (!includeDeleted && row.is_deleted) return false;
    if (!query) return true;
    return [row.deptcode, row.deptname].some((v) => v?.toLowerCase().includes(query));
  });

  return NextResponse.json(
    {
      departments,
      permissions: {
        add: context.access.rights.has("add_department" as BusinessRight),
        edit: context.access.rights.has("edit_department" as BusinessRight),
        delete: context.access.rights.has("delete_department" as BusinessRight),
        canViewDeleted: context.access.rights.has("delete_department" as BusinessRight),
        canRestore: context.access.rights.has("delete_department" as BusinessRight) && includeDeleted,
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
  if (!context.access.rights.has("add_department" as BusinessRight)) return fail("You cannot add departments.", 403);

  const body = payload as Record<string, unknown>;
  const deptcode = typeof body.deptcode === "string" ? body.deptcode.trim().toUpperCase() : "";
  const deptname = typeof body.deptname === "string" ? body.deptname.trim() : "";
  if (!deptcode || deptcode.length > 3) return fail("Department code must be 1-3 characters.", 400);
  if (!deptname || deptname.length > 20) return fail("Department name must be 1-20 characters.", 400);

  const { data, error } = await context.session
    .from("department")
    .insert({ deptcode, deptname })
    .select("deptcode, deptname, is_deleted, stamp")
    .single();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "department creation");
    return fail(mapped.error, mapped.status);
  }
  return NextResponse.json({ department: data }, { status: 201, headers: noStore });
}
